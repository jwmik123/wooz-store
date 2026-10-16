"""
Rig the Meshy AI "Moos" character in code, with a skeleton that MATCHES the
Quaternius Universal Animation Library (UAL) rig, so its CC0 clips transfer
with no per-bone guesswork (see retarget_anims.py, which imports this module).

Library use (from retarget_anims.py):
    import rig_moos
    mesh, M = rig_moos.load_moos(meshy_glb)
    arm, info = rig_moos.build_ual_rig(mesh, M, ual_armature)
    rig_moos.skin(mesh, arm, M)

Standalone (rig + pose tests, no clips):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/moos/rig_moos.py -- \
      <meshy.glb> <ual.glb> <out.glb> [--renders <dir>] [--portrait <portrait.png>]

How the skeleton is built
  * same bone names / hierarchy as UAL (root, pelvis, spine_01..03, neck_01,
    Head, clavicle/upperarm/lowerarm/hand, thigh/calf/foot/ball _l/_r);
    no finger bones (Moos' fingers are fused low-poly mitts)
  * joints (bone heads) sit on Moos' own landmarks (LANDMARKS below, measured
    on the Meshy mesh by slice analysis + x-ray renders)
  * rest ORIENTATION of every bone = the UAL rest orientation, swung by the
    minimal rotation that takes the UAL limb direction onto Moos' limb
    direction (Moos is in an A-pose, UAL in a T-pose). Swing-only means the
    twist/roll reference of every arm bone is the UAL one, so upper-arm /
    forearm / hand twist in the clips lands on the same anatomical axis
    (the old hand-made rig had arbitrary rolls -> the "wrong-way" wave).
  * retargeting is then a constant per-bone offset in armature space:
        moosWorld(t) = ualWorld(t) * ualRest^-1 * swing^-1 * moosRest
    (stored as info[bone]["offset"]).
"""
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix, Quaternion, kdtree

TARGET_HEIGHT = 1.78  # metres

# Joint landmarks in SOURCE (Meshy) units. Blender axes: +Z up, character
# faces -Y, character's left = +X. Left side only; right side is mirrored.
LANDMARKS = {
    "hips":      (0.0, 0.015, -0.13),
    "spine":     (0.0, 0.020, -0.02),
    "spine1":    (0.0, 0.025, 0.14),
    "spine2":    (0.0, 0.030, 0.30),
    "neck":      (0.0, 0.020, 0.56),
    "head":      (0.0, 0.000, 0.665),
    "head_end":  (0.0, 0.000, 0.95),
    "shoulder":  (0.04, 0.020, 0.50),
    "upper_arm": (0.175, 0.030, 0.465),
    "forearm":   (0.330, 0.035, 0.235),
    "hand":      (0.462, 0.000, 0.020),
    "hand_end":  (0.525, -0.020, -0.125),
    "thigh":     (0.095, 0.010, -0.17),
    "shin":      (0.100, 0.000, -0.53),
    "foot":      (0.115, 0.040, -0.85),
    "ball":      (0.121, -0.090, -0.922),
    "toe":       (0.127, -0.170, -0.930),
}

# moos bone (UAL name) -> (head landmark, direction landmark, UAL direction child)
# The UAL direction is measured head -> head of that UAL bone (or its tail when None).
BONES = [
    ("pelvis",   "hips",      "spine",     "spine_01"),
    ("spine_01", "spine",     "spine1",    "spine_02"),
    ("spine_02", "spine1",    "spine2",    "spine_03"),
    ("spine_03", "spine2",    "neck",      "neck_01"),
    ("neck_01",  "neck",      "head",      "Head"),
    ("Head",     "head",      "head_end",  None),
    ("clavicle", "shoulder",  "upper_arm", "upperarm"),
    ("upperarm", "upper_arm", "forearm",   "lowerarm"),
    ("lowerarm", "forearm",   "hand",      "hand"),
    ("hand",     "hand",      "hand_end",  "middle_01"),
    ("thigh",    "thigh",     "shin",      "calf"),
    ("calf",     "shin",      "foot",      "foot"),
    ("foot",     "foot",      "ball",      "ball"),
    ("ball",     "ball",      "toe",       "ball_leaf"),
]
SIDED = {"clavicle", "upperarm", "lowerarm", "hand", "thigh", "calf", "foot", "ball",
         "upperarm", "middle_01", "ball_leaf"}
PARENT = {
    "root": None, "pelvis": "root", "spine_01": "pelvis", "spine_02": "spine_01",
    "spine_03": "spine_02", "neck_01": "spine_03", "Head": "neck_01",
    "clavicle": "spine_03", "upperarm": "clavicle", "lowerarm": "upperarm", "hand": "lowerarm",
    "thigh": "pelvis", "calf": "thigh", "foot": "calf", "ball": "foot",
}


def log(*a):
    print("[rig_moos]", *a, flush=True)


def sided(name, suffix):
    return name + suffix if name in SIDED else name


def expand():
    """[(moos bone, head lm, dir lm, ual dir child, side sign, parent)] for both sides, parents first."""
    out = []
    for name, h, d, child in BONES:
        sides = [("_l", 1), ("_r", -1)] if name in SIDED else [("", 1)]
        for suf, s in sides:
            par = PARENT[name]
            out.append((sided(name, suf), h, d, child and sided(child, suf), s,
                        par and sided(par, suf)))
    return out


# ------------------------------------------------------------------ mesh ----
def load_moos(src):
    """Import the Meshy GLB, weld seams, scale to metres with feet at z=0. Returns (mesh, M)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=src)
    new = [o for o in bpy.data.objects if o not in before]
    mesh = [o for o in new if o.type == "MESH"][0]
    mesh.name = "moos"
    for o in new:
        if o is not mesh:
            bpy.data.objects.remove(o, do_unlink=True)
    mesh.parent = None
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    zs = [v.co.z for v in mesh.data.vertices]
    zmin, zmax = min(zs), max(zs)
    scale = TARGET_HEIGHT / (zmax - zmin)
    log("source height", zmax - zmin, "scale", scale)

    # weld seams (UVs live on loops, so welding keeps the UV seams)
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    log("weld", n0, "->", len(bm.verts))
    bm.to_mesh(mesh.data)
    bm.free()

    M = Matrix.Translation((0, 0, -zmin * scale)) @ Matrix.Scale(scale, 4)
    mesh.data.transform(M)
    mesh.data.update()
    mesh.select_set(False)
    return mesh, M


def landmark(M, name, side=1):
    x, y, z = LANDMARKS[name]
    return M @ Vector((x * side, y, z))


def swing(a, b):
    """Minimal rotation taking direction a onto direction b."""
    return a.normalized().rotation_difference(b.normalized())


# -------------------------------------------------------------- armature ----
def build_ual_rig(mesh, M, src_arm):
    """Build Moos' armature from the UAL armature `src_arm` (rest pose). Returns (arm, info)."""
    sb = src_arm.data.bones
    S = {b.name: b.matrix_local.copy() for b in sb}  # armature-space rest matrices (UAL)

    def s_head(n):
        return S[n].translation

    arm_data = bpy.data.armatures.new("moos_rig")
    arm = bpy.data.objects.new("moos_rig", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    info = {}

    # root: same orientation as UAL's, on the ground under the pelvis
    r = eb.new("root")
    r.tail = (0, 1, 0)  # a zero-length new bone ignores .matrix
    r.matrix = S["root"]
    r.length = 0.2
    r.use_deform = False
    info["root"] = {"offset": Quaternion()}

    for name, h, d, child, side, parent in expand():
        head = landmark(M, h, side)
        moos_dir = landmark(M, d, side) - head
        Sr = S[name].to_3x3()
        if child:
            ual_dir = s_head(child) - s_head(name)
        else:
            ual_dir = Sr.col[1].copy()
        Rsw = swing(ual_dir, moos_dir).to_matrix()
        rest = Rsw @ Sr  # UAL orientation swung onto Moos' limb
        # The UAL bone's own Y axis isn't always exactly along "head -> child head"
        # (importer heuristics); align it so bone heat sees a bone along the limb.
        y = rest.col[1]
        fix = swing(y, moos_dir).to_matrix()
        rest = fix @ rest
        b = eb.new(name)
        b.tail = (0, 1, 0)
        b.matrix = Matrix.LocRotScale(head, rest.to_quaternion(), None)
        b.length = max(moos_dir.length, 0.04)
        if parent:
            b.parent = eb[parent]
        b.use_connect = False
        b.use_deform = True
        # constant retarget offset: moosWorld = ualWorld @ offset
        off = (Sr.inverted() @ Rsw.inverted() @ rest).to_quaternion()
        info[name] = {"offset": off}
        err = math.degrees(y.angle(moos_dir)) if y.length > 0 else 0
        log(f"bone {name:12s} swing {math.degrees(Rsw.to_quaternion().angle):6.1f} deg  axis-fix {err:5.1f} deg")
    eb["pelvis"].parent = eb["root"]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm, info


# --------------------------------------------------------------- weights ----
def skin(mesh, arm, M):
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")

    vg_names = {g.index: g.name for g in mesh.vertex_groups}
    verts = mesh.data.vertices
    weighted = [v.index for v in verts if sum(e.weight for e in v.groups) > 1e-3]
    unweighted = [v.index for v in verts if sum(e.weight for e in v.groups) <= 1e-3]
    log("unweighted vertices:", len(unweighted), "/", len(verts))
    if unweighted:
        kd = kdtree.KDTree(len(weighted))
        for i in weighted:
            kd.insert(verts[i].co, i)
        kd.balance()
        for i in unweighted:
            _, j, _ = kd.find(verts[i].co)
            for e in verts[j].groups:
                mesh.vertex_groups[e.group].add([i], e.weight, "REPLACE")

    # Hair/face above the jaw line follow the head only (no neck/spine
    # stretching of the curls); the hood collar stays cloth (spine/neck).
    head_z = landmark(M, "head").z
    scale = M.to_scale()[0]
    for v in verts:
        if v.co.z > head_z + 0.05 * scale:
            for g in list(v.groups):
                if vg_names[g.group] != "Head":
                    mesh.vertex_groups[g.group].remove([v.index])
            mesh.vertex_groups["Head"].add([v.index], 1.0, "REPLACE")

    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    bpy.ops.object.vertex_group_clean(group_select_mode="ALL", limit=0.01)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    mesh.select_set(False)
    if "root" in mesh.vertex_groups:
        mesh.vertex_groups.remove(mesh.vertex_groups["root"])


# ---------------------------------------------------------------- render ----
def setup_render(res=480, textured=True):
    scn = bpy.context.scene
    scn.render.engine = "BLENDER_WORKBENCH"
    scn.display.shading.color_type = "TEXTURE" if textured else "OBJECT"
    scn.display.shading.light = "STUDIO"
    scn.render.resolution_x = res
    scn.render.resolution_y = res
    return scn


def setup_cam(ortho=1.95, loc=(0, -6, 0.89), rot=(math.pi / 2, 0, 0)):
    scn = bpy.context.scene
    cam = scn.camera
    if cam is None:
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        scn.collection.objects.link(cam)
        scn.camera = cam
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho
    cam.location = loc
    cam.rotation_euler = rot
    return cam


VIEWS = {
    "front": ((0, -6, 0.89), (math.pi / 2, 0, 0)),
    "front34": ((-3.0, -5.2, 0.89), (math.pi / 2, 0, -math.radians(30))),
    "side": ((-6, 0, 0.89), (math.pi / 2, 0, -math.pi / 2)),
    "back34": ((3.0, 5.2, 0.89), (math.pi / 2, 0, math.radians(150))),
}


def render_portrait(mesh, path):
    scn = bpy.context.scene
    engines = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys()
    scn.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scn.render.film_transparent = True
    scn.render.resolution_x = 512
    scn.render.resolution_y = 512
    scn.view_settings.view_transform = "AgX"
    for mat in mesh.data.materials:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf:
            for l in list(bsdf.inputs["Metallic"].links) + list(bsdf.inputs["Roughness"].links):
                mat.node_tree.links.remove(l)
            bsdf.inputs["Metallic"].default_value = 0.0
            bsdf.inputs["Roughness"].default_value = 0.8
    world = bpy.data.worlds.new("w")
    scn.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.85, 0.9, 1.0, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.35

    def light(name, loc, energy, color, size):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy, ld.color, ld.size = energy, color, size
        o = bpy.data.objects.new(name, ld)
        o.location = loc
        scn.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, 1.5)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    light("key", (-1.0, -1.6, 2.2), 28, (1.0, 0.95, 0.88), 1.2)
    light("fill", (1.4, -1.2, 1.6), 9, (0.85, 0.92, 1.0), 1.5)
    light("rim", (0.6, 1.5, 2.0), 22, (1.0, 1.0, 1.0), 1.0)
    cam = setup_cam()
    cam.data.type = "PERSP"
    cam.data.lens = 85
    cam.location = (-0.32, -1.9, 1.6)
    cam.rotation_euler = (Vector((0, 0, 1.5)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    log("portrait", path)


def import_ual(path):
    """Import a UAL GLB; returns its armature (mannequin mesh kept as child for comparison renders)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arm = [o for o in new if o.type == "ARMATURE"][0]
    for o in new:
        if o.type == "MESH" and o.parent is not arm:
            bpy.data.objects.remove(o, do_unlink=True)
    return arm


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:]
    SRC, UAL, OUT = argv[0], argv[1], argv[2]
    RENDERS = argv[argv.index("--renders") + 1] if "--renders" in argv else None
    PORTRAIT = argv[argv.index("--portrait") + 1] if "--portrait" in argv else None
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ual = import_ual(UAL)
    mesh, M = load_moos(SRC)
    arm, info = build_ual_rig(mesh, M, ual)
    skin(mesh, arm, M)
    for o in list(bpy.data.objects):
        if o not in (mesh, arm):
            bpy.data.objects.remove(o, do_unlink=True)
    if RENDERS:
        setup_render()
        for v in ("front", "side"):
            setup_cam(loc=VIEWS[v][0], rot=VIEWS[v][1])
            bpy.context.scene.render.filepath = f"{RENDERS}/moos2-pose-rest-{v}.png"
            bpy.ops.render.render(write_still=True)
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format="GLB", use_selection=True,
        export_skins=True, export_animations=False, export_morph=False,
        export_yup=True, export_apply=False, export_def_bones=True,
    )
    if PORTRAIT:
        render_portrait(mesh, PORTRAIT)
