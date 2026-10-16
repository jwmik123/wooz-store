"""
Rig the Meshy AI "Moos" character in code (no paid auto-rig).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/moos/rig_moos.py -- \
      <in.glb> <out.glb> [--renders <dir>] [--portrait <portrait.png>]

Steps
  1. import the Meshy GLB (single mesh, A-pose, ~1.9 units tall, facing -Y in Blender)
  2. weld duplicate vertices (glTF splits at UV seams) so bone heat sees one surface
  3. scale to real metres (1.78 m), feet at z=0 (glTF: y=0, facing +Z)
  4. build a humanoid armature from landmarks measured on the mesh
     (slice analysis + front/side renders, see LANDMARKS below; in source units)
  5. automatic (bone heat) weights; vertices heat could not reach get the
     weights of their nearest weighted neighbour; max 4 influences, normalised
  6. optional pose-test renders (arm up, wave, head turn, bend, think)
  7. export skinned GLB (no animations; Moos is animated procedurally at runtime)
  8. optional portrait render for the chat launcher avatar (transparent bg)

The output still has the original 2K PNG textures; scripts/moos/optimize-moos.mjs
turns it into the shipped public/models/v2/moos.glb (KTX2 + meshopt).
"""
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix, Quaternion, kdtree

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
RENDERS = argv[argv.index("--renders") + 1] if "--renders" in argv else None
PORTRAIT = argv[argv.index("--portrait") + 1] if "--portrait" in argv else None

TARGET_HEIGHT = 1.78  # metres

# Joint landmarks in SOURCE units (Blender axes: +Z up, character faces -Y,
# character's left = +X). Measured from slice analysis of the mesh (crotch at
# z=-0.23, neck narrowest at z~0.67, hands tips at |x|~0.54, z~-0.14) and
# checked with x-ray overlay renders. Left side only; right side is mirrored.
L = {
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
    "toe":       (0.125, -0.150, -0.935),
}

# name: (head landmark, tail landmark, parent, mirrored?)
BONES = [
    ("hips", "hips", "spine", None, False),
    ("spine", "spine", "spine1", "hips", False),
    ("spine1", "spine1", "spine2", "spine", False),
    ("spine2", "spine2", "neck", "spine1", False),
    ("neck", "neck", "head", "spine2", False),
    ("head", "head", "head_end", "neck", False),
    ("shoulder", "shoulder", "upper_arm", "spine2", True),
    ("upper_arm", "upper_arm", "forearm", "shoulder", True),
    ("forearm", "forearm", "hand", "upper_arm", True),
    ("hand", "hand", "hand_end", "forearm", True),
    ("thigh", "thigh", "shin", "hips", True),
    ("shin", "shin", "foot", "thigh", True),
    ("foot", "foot", "toe", "shin", True),
]


def log(*a):
    print("[rig_moos]", *a, flush=True)


# ---------------------------------------------------------------- import ----
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
mesh = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
mesh.name = "moos"
for o in list(bpy.context.scene.objects):
    if o is not mesh:
        bpy.data.objects.remove(o, do_unlink=True)
mesh.parent = None
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

# metres, feet on the ground
M = Matrix.Translation((0, 0, -zmin * scale)) @ Matrix.Scale(scale, 4)
mesh.data.transform(M)
mesh.data.update()


def P(name, side=1):
    x, y, z = L[name]
    return M @ Vector((x * side, y, z))


# -------------------------------------------------------------- armature ----
arm_data = bpy.data.armatures.new("moos_rig")
arm = bpy.data.objects.new("moos_rig", arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones
for name, h, t, parent, mirrored in BONES:
    sides = [("_L", 1), ("_R", -1)] if mirrored else [("", 1)]
    for suffix, s in sides:
        b = eb.new(name + suffix)
        b.head = P(h, s)
        b.tail = P(t, s)
        if parent:
            pname = parent + (suffix if parent in {"shoulder", "upper_arm", "forearm", "thigh", "shin"} else "")
            b.parent = eb[pname]
            b.use_connect = False
        # consistent rolls: z axis points forward (-Y) for every bone
        b.align_roll(Vector((0, -1, 0)))
for b in eb:
    b.use_deform = True
bpy.ops.object.mode_set(mode="OBJECT")
log("bones", [b.name for b in arm_data.bones])

# --------------------------------------------------------------- weights ----
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

vg_names = {g.index: g.name for g in mesh.vertex_groups}
empty_groups = [g.name for g in mesh.vertex_groups
                if not any(g.index == e.group and e.weight > 0 for v in mesh.data.vertices for e in v.groups)]
log("groups without weights:", empty_groups)

# fill vertices bone heat could not reach with the nearest weighted vertex
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

# Hand-tuned overrides from the pose tests:
#  - the face/hair must follow the head only (no neck/spine stretching of the curls)
#  - the hood collar is cloth: spine2/neck, never the head
head_z = P("head").z
for v in verts:
    if v.co.z > head_z + 0.05 * scale:  # clearly above the jaw line
        for g in list(v.groups):
            if vg_names[g.group] != "head":
                mesh.vertex_groups[g.group].remove([v.index])
        mesh.vertex_groups["head"].add([v.index], 1.0, "REPLACE")

bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
bpy.ops.object.vertex_group_clean(group_select_mode="ALL", limit=0.01)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
mesh.select_set(False)

# ---------------------------------------------------------------- render ----
scn = bpy.context.scene


def setup_cam(ortho=1.95, loc=(0, -6, 0.89), rot=(math.pi / 2, 0, 0)):
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


def pose(rots):
    """rots: {bone: (axis 'X'/'Y'/'Z' in model space, degrees), ...} applied around the joint."""
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
    bpy.context.view_layer.update()
    # parents first so model-space conjugation uses the posed parent frame
    for name, rlist in rots.items():
        pb = arm.pose.bones[name]
        for axis, deg in rlist:
            R = Matrix.Rotation(math.radians(deg), 4, axis)
            cur = (arm.matrix_world @ pb.matrix).to_3x3()
            rest = arm.data.bones[name].matrix_local.to_3x3()
            # local delta so the bone rotates by R in model space from its current orientation
            q = (rest.inverted() @ R.to_3x3() @ cur).to_quaternion()
            par = pb.parent
            if par is not None:
                prest = arm.data.bones[par.name].matrix_local.to_3x3()
                pcur = par.matrix.to_3x3()
                q = ((pcur @ prest.inverted() @ rest).inverted() @ R.to_3x3() @ cur).to_quaternion()
            pb.rotation_quaternion = q
            bpy.context.view_layer.update()


if RENDERS:
    scn.render.engine = "BLENDER_WORKBENCH"
    scn.display.shading.color_type = "TEXTURE"
    scn.display.shading.light = "STUDIO"
    scn.render.resolution_x = 480
    scn.render.resolution_y = 480
    tests = {
        "rest": {},
        "armsup": {"upper_arm_L": [("Y", -70)], "upper_arm_R": [("Y", 70)]},
        "wave": {"upper_arm_R": [("Y", 100)], "forearm_R": [("Y", 45)]},
        "headturn": {"head": [("Z", 40)], "neck": [("Z", 15)]},
        "bend": {"spine1": [("X", 20)], "spine2": [("X", 15), ("Y", 10)], "thigh_L": [("X", -45)], "shin_L": [("X", 60)]},
        "think": {"upper_arm_R": [("Y", -25), ("X", -35), ("Z", 25)], "forearm_R": [("X", -135)], "head": [("Y", -10), ("X", -10)]},
    }
    for tname, rots in tests.items():
        pose(rots)
        for view, loc, rot in [("front", (0, -6, 0.89), (math.pi / 2, 0, 0)),
                               ("side", (6, 0, 0.89), (math.pi / 2, 0, math.pi / 2))]:
            if tname != "rest" and view == "side" and tname not in ("bend", "think"):
                continue
            setup_cam(loc=loc, rot=rot)
            scn.render.filepath = f"{RENDERS}/ws5-pose-{tname}-{view}.png"
            bpy.ops.render.render(write_still=True)
    # head close-up for the neck/hood seam
    pose(tests["headturn"])
    setup_cam(ortho=0.6, loc=(0.0, -6, 1.45))
    scn.render.filepath = f"{RENDERS}/ws5-pose-headturn-close.png"
    bpy.ops.render.render(write_still=True)
    pose({})

# ----------------------------------------------------------------- export ----
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", use_selection=True,
    export_skins=True, export_animations=False, export_morph=False,
    export_yup=True, export_apply=False, export_texcoords=True, export_normals=True,
    export_def_bones=True, export_image_format="AUTO",
)
log("exported", OUT)

# --------------------------------------------------------------- portrait ----
if PORTRAIT:
    scn.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys() else "BLENDER_EEVEE"
    scn.render.film_transparent = True
    scn.render.resolution_x = 512
    scn.render.resolution_y = 512
    scn.view_settings.view_transform = "AgX"
    # matte look like the runtime material
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
    def light(name, typ, loc, energy, color=(1, 1, 1), size=1.0):
        ld = bpy.data.lights.new(name, typ)
        ld.energy = energy
        ld.color = color
        if typ == "AREA":
            ld.size = size
        o = bpy.data.objects.new(name, ld)
        o.location = loc
        scn.collection.objects.link(o)
        d = Vector((0, 0, 1.5)) - Vector(loc)
        o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    light("key", "AREA", (-1.0, -1.6, 2.2), 28, (1.0, 0.95, 0.88), 1.2)
    light("fill", "AREA", (1.4, -1.2, 1.6), 9, (0.85, 0.92, 1.0), 1.5)
    light("rim", "AREA", (0.6, 1.5, 2.0), 22, (1.0, 1.0, 1.0), 1.0)
    # slight friendly pose
    pose({"head": [("Z", 10), ("Y", -5)], "upper_arm_L": [("Y", 22)], "upper_arm_R": [("Y", -22)]})
    cam = setup_cam()
    cam.data.type = "PERSP"
    cam.data.lens = 85
    cam.location = (-0.32, -1.9, 1.6)
    d = Vector((0, 0, 1.5)) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scn.render.filepath = PORTRAIT
    bpy.ops.render.render(write_still=True)
    log("portrait", PORTRAIT)
