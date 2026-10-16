"""
Rig Moos with a UAL-matching skeleton and bake a curated set of Quaternius
Universal Animation Library clips (CC0) onto him.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/moos/retarget_anims.py -- \
      <meshy_moos.glb> <UAL1_Standard.glb> <UAL2_Standard.glb> <out.glb> [--renders <dir>]

Sources (free "Standard" tiers, CC0, https://quaternius.itch.io/):
  UAL1 = universal-animation-library, UAL2 = universal-animation-library-2
  (the in-place files, not *_RM; root motion of the walk is measured on the
  baked result instead, see WALK SPEED below).

Output: skinned GLB (full-res textures) with clips
  idle, talk, think, happy, wave, walk
and armature extras {"moosWalkSpeed": metres/second at scale 1}.
Then: node scripts/moos/optimize-moos.mjs <out.glb> public/models/v2/moos.glb
"""
import bpy, sys, os, math, json
from mathutils import Vector, Matrix, Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig_moos as R  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
MESHY, UAL1, UAL2, OUT = argv[:4]
RENDERS = argv[argv.index("--renders") + 1] if "--renders" in argv else None
FPS = 24

# name -> (source action, kind) ; kind: loop | once
CLIPS = {
    "idle": ("Idle_Loop", "loop"),
    "talk": ("Idle_Talking_Loop", "loop"),
    "think": ("Idle_FoldArms_Loop", "loop"),
    "happy": ("Dance_Loop", "loop"),  # small groove; "Yes" (thumbs up) reads as pointing without a thumb
    "walk": ("Walk_Loop", "loop"),
    "wave": ("Idle_Loop", "loop"),  # idle body + hand-authored right-arm wave (see wave_override)
}

log = R.log

# ------------------------------------------------------------------ setup ----
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = FPS
src = R.import_ual(UAL1)
src.name = "ual"
# UAL2: only its actions are needed (same rig); drop its objects
ual2 = R.import_ual(UAL2)
for o in list(ual2.children) + [ual2]:
    bpy.data.objects.remove(o, do_unlink=True)
for a in bpy.data.actions:
    a.use_fake_user = True

mesh, M = R.load_moos(MESHY)
arm, info = R.build_ual_rig(mesh, M, src)
R.skin(mesh, arm, M)

order = ["root"] + [e[0] for e in R.expand()]
mrest = {b.name: b.matrix_local.copy() for b in arm.data.bones}
srest = {b.name: b.matrix_local.copy() for b in src.data.bones}

# Leg-length ratio Moos/UAL scales the pelvis translation (crouch, bob, sway).
def leg(rest, s):
    return (rest[f"thigh{s}"].translation - rest[f"foot{s}"].translation).length

K = leg(mrest, "_l") / leg(srest, "_l")
log("leg ratio", K)


def set_src_action(name):
    act = bpy.data.actions[name]
    src.animation_data_create()
    src.animation_data.action = act
    if getattr(act, "slots", None):
        src.animation_data.action_slot = act.slots[0]
    return act


# ---------------------------------------------------------------- wave -------
def frame_from(d, t):
    """Rotation whose bone-local Y maps to d and whose thumb axis maps to ~t."""
    d = d.normalized()
    t = (t - d * t.dot(d)).normalized()
    return Matrix((t, d, t.cross(d))).transposed()  # columns: t, d, t x d


def wave_override(S, f, n):
    """Replace the right arm in UAL world rotations S (dict bone -> 3x3) with a friendly wave.
    Authored in UAL space: in the T-pose rest the arm points -X (his right), palm down (-Z),
    thumb forward (-Y). Elbow flexes towards the thumb side."""
    ph = 2 * math.pi * 5 * f / n  # 5 waves per 2.5 s loop
    s = math.sin(ph)
    out = dict(S)
    # Rest frames of the right-arm bones: (bone dir, thumb dir) in UAL rest
    def rest_frame(b, child):
        d = srest[child].translation - srest[b].translation
        return frame_from(d, Vector((0, -1, 0)))

    def place(b, child, d, thumb):
        F0 = rest_frame(b, child)
        F1 = frame_from(d, thumb)
        Q = F1 @ F0.inverted()  # rotate rest frame onto desired frame
        out[b] = Q @ srest[b].to_3x3()

    up = Vector((0, 0, 1))
    # upper arm: out to his right, ~25 deg above horizontal, a bit forward;
    # externally rotated so the elbow bends upwards (thumb axis -> up/back)
    ua = Vector((-0.86, -0.22, 0.42))
    place("upperarm_r", "lowerarm_r", ua, Vector((0.0, 0.3, 1.0)))
    # forearm: vertical, swinging +-17 deg in the frontal plane around the elbow
    a = math.radians(14 + 17 * s)  # tilt outwards (towards -X)
    fa = Vector((-math.sin(a), -0.18, math.cos(a)))
    place("lowerarm_r", "hand_r", fa, Vector((1.0, 0.0, 0.0)))  # thumb towards the head
    # hand: open palm to the front, wrist trails the forearm a little
    a2 = math.radians(14 + 17 * math.sin(ph - 0.7) + 6)
    hd = Vector((-math.sin(a2), -0.1, math.cos(a2)))
    place("hand_r", "middle_01_r", hd, Vector((1.0, 0.0, 0.0)))
    # clavicle lifts a little with the raised arm
    lift = Matrix.Rotation(math.radians(-12), 3, Vector((0, 1, 0)))  # raise the outer end (his right)
    out["clavicle_r"] = lift @ S["clavicle_r"]
    # small friendly head tilt towards the waving hand
    tilt = Matrix.Rotation(math.radians(-4 + 1.5 * s), 3, Vector((0, 1, 0)))
    out["Head"] = tilt @ S["Head"]
    return out


# ---------------------------------------------------------------- bake -------
def sample_source(f):
    bpy.context.scene.frame_set(int(f), subframe=f - int(f))
    S, P = {}, None
    for name in order:
        pb = src.pose.bones[name]
        S[name] = pb.matrix.to_3x3().normalized()
    P = src.pose.bones["pelvis"].matrix.translation.copy()
    return S, P


def bake(clip, action_name, kind):
    act_src = set_src_action(action_name)
    f0, f1 = act_src.frame_range
    n = int(round(f1 - f0))
    act = bpy.data.actions.new(clip)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    prev = {}
    p_rest_src = srest["pelvis"].translation
    p_rest_moos = mrest["pelvis"].translation
    for i in range(n + 1):
        f = f0 + i
        S, P = sample_source(f)
        if clip == "wave":
            S = wave_override(S, i, n)
        elif clip == "walk":
            # Moos' big head reads as looking at his shoes in the UAL walk: lift the gaze
            S["neck_01"] = Matrix.Rotation(math.radians(-5), 3, "X") @ S["neck_01"]
            S["Head"] = Matrix.Rotation(math.radians(-8), 3, "X") @ S["Head"]
        W = {}
        for name in order:
            rest = mrest[name]
            if name == "root":
                W[name] = rest.copy()
                continue
            Tw = S[name] @ info[name]["offset"].to_matrix()
            if name == "pelvis":
                pos = p_rest_moos + (P - p_rest_src) * K
            else:
                pos = None
            par = arm.data.bones[name].parent.name
            parent_pose = W[par]
            loc_rest = parent_pose @ mrest[par].inverted() @ rest  # where the bone would be unposed
            if pos is None:
                pos = loc_rest.translation
            W[name] = Matrix.LocRotScale(pos, Tw.to_quaternion(), None)
            basis = loc_rest.inverted() @ W[name]
            pb = arm.pose.bones[name]
            q = basis.to_quaternion()
            if name in prev and prev[name].dot(q) < 0:
                q.negate()
            prev[name] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=i, group=name)
            if name == "pelvis":
                pb.location = basis.translation
                pb.keyframe_insert("location", frame=i, group=name)
    log("baked", clip, "from", action_name, n + 1, "frames", kind)
    return act


actions = {}
for clip, (srcname, kind) in CLIPS.items():
    actions[clip] = bake(clip, srcname, kind)

# --------------------------------------------------------- walk speed --------
# The in-place walk: during stance a foot slides backwards at exactly the speed
# the character must move forward. Measure it on the baked Moos walk (median
# of the planted-foot velocity), at scale 1.
arm.animation_data.action = actions["walk"]
mw = arm.matrix_world
samples = []
n = int(actions["walk"].frame_range[1])
for side in ("_l", "_r"):
    pts = []
    for f in range(n + 1):
        bpy.context.scene.frame_set(f)
        pts.append((mw @ arm.pose.bones["ball" + side].head))
    zmin = min(p.z for p in pts)
    for f in range(n):
        if pts[f].z < zmin + 0.012 and pts[f + 1].z < zmin + 0.012:
            samples.append((pts[f].y - pts[f + 1].y) * FPS)  # forward is -Y
samples.sort()
WALK_SPEED = abs(samples[len(samples) // 2]) if samples else 0.0
log("walk speed (m/s at scale 1):", WALK_SPEED, "from", len(samples), "planted samples")
arm["moosWalkSpeed"] = round(WALK_SPEED, 4)
arm["moosClips"] = json.dumps({k: v[1] for k, v in CLIPS.items()})

# ---------------------------------------------------------------- renders ----
if RENDERS:
    os.makedirs(RENDERS, exist_ok=True)
    scn = R.setup_render(560, textured=True)
    mann = [o for o in src.children if o.type == "MESH"]
    # place the UAL mannequin next to Moos for side-by-side comparison
    src.location = (1.1, 0, 0)
    tests = [("wave", 7, "front"), ("wave", 7, "front34"), ("walk", 0, "side"), ("walk", 8, "side"),
             ("walk", 4, "front34"), ("idle", 30, "front"), ("talk", 20, "front34"),
             ("think", 30, "front34"), ("happy", 6, "front34"), ("happy", 18, "front34")]
    for clip, f, view in tests:
        arm.animation_data.action = actions[clip]
        srcname = CLIPS[clip][0]
        set_src_action(srcname)
        scn.frame_set(f)
        loc, rot = R.VIEWS[view]
        if view == "side":  # mannequin behind-right in screen space
            src.location = (0, 1.1, 0)
            R.setup_cam(ortho=2.3, loc=(-6, 0.55, 0.95), rot=rot)
        else:
            src.location = (1.1, 0, 0)
            R.setup_cam(ortho=2.3, loc=(loc[0] + 0.55, loc[1], 0.95), rot=rot)
        scn.render.filepath = f"{RENDERS}/moos2-pose-{clip}-{f}-{view}.png"
        bpy.ops.render.render(write_still=True)
    # close-up of the waving shoulder/arm
    arm.animation_data.action = actions["wave"]
    for f in (3, 7):
        scn.frame_set(f)
        R.setup_cam(ortho=0.9, loc=(-0.95, -5.2, 1.3), rot=(math.pi / 2, 0, -math.radians(8)))
        scn.render.filepath = f"{RENDERS}/moos2-pose-wave-close-{f}.png"
        bpy.ops.render.render(write_still=True)
    src.location = (0, 0, 0)

# ----------------------------------------------------------------- export ----
for o in list(bpy.data.objects):
    if o not in (mesh, arm):
        bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions):
    if a.name not in CLIPS:
        bpy.data.actions.remove(a)
# every clip on its own NLA track so the exporter writes all of them
arm.animation_data.action = None
for clip, act in actions.items():
    tr = arm.animation_data.nla_tracks.new()
    tr.name = clip
    st = tr.strips.new(clip, 0, act)
    st.name = clip
    tr.mute = True
bpy.context.scene.frame_set(0)
for pb in arm.pose.bones:
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.location = (0, 0, 0)
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", use_selection=True,
    export_skins=True, export_animations=True, export_animation_mode="NLA_TRACKS",
    export_force_sampling=False, export_optimize_animation_size=True,
    export_morph=False, export_yup=True, export_apply=False, export_def_bones=True,
    export_extras=True, export_anim_single_armature=True, export_reset_pose_bones=True,
)
log("exported", OUT)
