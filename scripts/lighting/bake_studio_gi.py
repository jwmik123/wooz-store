"""
Bake the studio's static global illumination into lightmaps (workstream 9).

    /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/lighting/bake_studio_gi.py -- \
        [--res 2048] [--samples 512] [--out /tmp/wooz-lightmaps] [--quick]

then encode + install the result:

    scripts/lighting/encode_lightmaps.sh /tmp/wooz-lightmaps

What gets baked (Cycles, DIFFUSE bake WITHOUT the colour pass → lighting only,
the albedo of the baked surface is NOT in the map; bounces DO use the real
albedo atlas so wood/plant/lawn colour bleeding is captured):

  sky.exr    RGB  sky-dome irradiance (uniform white sky of radiance 1, no sun)
                  over the garden lawn (+ plinth, apple-tree crowns). Direct + indirect.
                  Value 1.0 = an unoccluded up-facing surface under that sky.
  lamp.exr   RGB  interior practicals only (table lamp + 2 rack lights, world
                  black). Direct + indirect. Stored as one channel.
  sun.exr    RGB  INDIRECT-only sun bounce, averaged over three sun positions
                  (morning / noon / afternoon) of a sun of irradiance π, i.e.
                  map × albedo = bounce radiance for a three.js
                  DirectionalLight of intensity 1. Stored as one channel.

Everything lands in the GLB's TEXCOORD_0 (= Blender "UVMap"), the same
non-overlapping 0..1 bake atlas as the albedo, for the studio AND the 18
garments, so they get their own occlusion too.

Outputs in --out:  lm_sky.png (RGB, sRGB-encoded / scale), lm_aux.png
(R = lamp, G = sun bounce, sRGB-encoded / scale) and lightmap.json (scales).

World frame mapping (app world W → Blender b): b = (W.z + 1.405, W.x, W.y + 1.895)
(see app/three/v2/Studio.jsx: studio local → world (-z, y - 1.895, x - 1.405),
glTF→Blender is (x, -z, y)).
"""

import bpy
import json
import math
import os
import sys
import time

import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    if name in argv:
        i = argv.index(name)
        return type(default)(argv[i + 1]) if not isinstance(default, bool) else True
    return default


RES = arg("--res", 2048)
SAMPLES = arg("--samples", 512)
QUICK = arg("--quick", False)
OUT = arg("--out", "/tmp/wooz-lightmaps")
GLB = arg("--glb", os.path.join(REPO, "public/models/v2/studio-original.glb"))
if QUICK:
    RES, SAMPLES = 512, 32
os.makedirs(OUT, exist_ok=True)

# Garden (app/three/v2/garden/gardenCommon.js): lawn at app y = -2.02, pastel
# green with straw tints; the studio slab sits on a 9 cm stone plinth.
GRASS = (0.24, 0.37, 0.13)  # linear ≈ sRGB #86a463 (lawn average incl. straw)
STONE = (0.55, 0.50, 0.42)  # linear ≈ sRGB #c4bba9 plinth
LEAVES = (0.12, 0.25, 0.08)  # linear ≈ sRGB #5f8a4c..#86ad5f crowns
GROUND_Y_APP = -2.02
PLINTH_TOP_APP = -1.95
# Apple trees (gardenCommon.js TREES): base x/z, height, crown radius. Crowns
# are baked as half-transparent spheres (foliage gaps) + trunks, so the roof and
# glass walls next to them get their soft sky occlusion / green tint.
TREES = [(-5.3, -1.6, 5.6, 3.1), (6.1, -5.2, 6.4, 3.3)]


def app_to_blender(x, y, z):
    return Vector((z + 1.405, x, y + 1.895))


# Interior practicals (keep in sync with app/three/v2/lighting/interior.js).
LAMPS = [
    # app position, radius (m), relative power
    ((0.34, -0.97, 1.29), 0.04, 1.0),  # table lamp (inside the pleated shade)
    ((-1.25, 0.2, -2.05), 0.1, 0.6),  # rack lights in front of the back shelves
    ((1.25, 0.2, -2.05), 0.1, 0.6),
]

# Sun directions (app world, towards the sun) for the bounce average; see
# lighting/atmosphere.js (east → south → west arc, 55° max elevation).
SUN_DIRS = [(0.55, 0.62, 0.56), (0.0, 0.82, 0.57), (-0.55, 0.62, 0.56)]


def log(*a):
    print("[bake]", *a, flush=True)


# --- scene -------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH"]
log("meshes", len(meshes))

albedo = next(i for i in bpy.data.images if "DIFFUSE" in i.name)

# Rebuild every material as plain diffuse with the albedo atlas (UVMap),
# plus an (unlinked) bake-target image node that is the active node.
targets = {}
for name in ("sky", "lamp", "sun"):
    img = bpy.data.images.new(f"lm_{name}", RES, RES, alpha=False, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    targets[name] = img

for mat in {m for o in meshes for m in o.data.materials}:
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfDiffuse")
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "UVMap"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = albedo
    nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    tgt = nt.nodes.new("ShaderNodeTexImage")
    tgt.name = "bake_target"
    nt.nodes.active = tgt

for o in meshes:
    uvl = o.data.uv_layers
    uvl.active = uvl["UVMap"]
    # Bake into UVMap; drop the second UV set so nothing picks it up.
    if "UVMap.001" in uvl:
        uvl.remove(uvl["UVMap.001"])

def diffuse_material(name, color, transparency=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    d = nt.nodes.new("ShaderNodeBsdfDiffuse")
    d.inputs["Color"].default_value = (*color, 1)
    if transparency > 0:
        t = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        mix.inputs["Fac"].default_value = transparency
        nt.links.new(d.outputs["BSDF"], mix.inputs[1])
        nt.links.new(t.outputs["BSDF"], mix.inputs[2])
        nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    else:
        nt.links.new(d.outputs["BSDF"], out.inputs["Surface"])
    return m


def add_obj(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    return obj


# Garden context (not baked, only occludes / bounces light).
bpy.ops.mesh.primitive_plane_add(size=80, location=app_to_blender(0, GROUND_Y_APP, 0) + Vector((0, 0, 0)))
add_obj(bpy.context.active_object, "lawn", diffuse_material("lawn", GRASS))
plinth_h = PLINTH_TOP_APP - GROUND_Y_APP + 0.03
bpy.ops.mesh.primitive_cube_add(size=1, location=app_to_blender(0, PLINTH_TOP_APP - plinth_h / 2, 0))
pl = bpy.context.active_object
pl.scale = (2 * 3.53, 2 * 2.21, plinth_h)  # blender x = app z, y = app x
add_obj(pl, "plinth", diffuse_material("stone", STONE))
leaf_mat = diffuse_material("crown", LEAVES, transparency=0.45)
bark_mat = diffuse_material("bark", (0.12, 0.09, 0.07))
for x, z, height, crown in TREES:
    c = app_to_blender(x, GROUND_Y_APP + height - crown * 0.95, z)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=crown, location=c, segments=24, ring_count=12)
    add_obj(bpy.context.active_object, "crown", leaf_mat)
    trunk_h = height - crown * 1.2
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=trunk_h, location=app_to_blender(x, GROUND_Y_APP + trunk_h / 2, z))
    add_obj(bpy.context.active_object, "trunk", bark_mat)

# World
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]

# --- cycles --------------------------------------------------------------------
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
    log("devices", [d.name for d in prefs.devices if d.use])
except Exception as e:  # noqa: BLE001
    log("GPU unavailable, CPU bake", e)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 0
scene.cycles.transparent_max_bounces = 8
scene.cycles.sample_clamp_indirect = 8.0
bake = scene.render.bake
bake.margin = max(4, RES // 128)
bake.margin_type = "EXTEND"
bake.use_clear = True
bake.target = "IMAGE_TEXTURES"


def set_target(img):
    for mat in {m for o in meshes for m in o.data.materials}:
        n = mat.node_tree.nodes["bake_target"]
        n.image = img
        mat.node_tree.nodes.active = n


def select_bake_objects():
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]


def do_bake(name, pass_filter):
    set_target(targets[name])
    select_bake_objects()
    t = time.time()
    bpy.ops.object.bake(type="DIFFUSE", pass_filter=pass_filter, use_clear=True)
    log(f"{name}: {time.time() - t:.1f}s")
    return np.array(targets[name].pixels[:], dtype=np.float32).reshape(RES, RES, 4)[..., :3].copy()


lights = []


def clear_lights():
    for l in lights:
        bpy.data.objects.remove(l, do_unlink=True)
    lights.clear()


t0 = time.time()

# 1) Sky: uniform white dome, no sun.
bg.inputs["Color"].default_value = (1, 1, 1, 1)
bg.inputs["Strength"].default_value = 1.0
sky = do_bake("sky", {"DIRECT", "INDIRECT"})

# 2) Lamps: world off.
bg.inputs["Strength"].default_value = 0.0
for pos, radius, power in LAMPS:
    ld = bpy.data.lights.new("lamp", "POINT")
    ld.energy = 40.0 * power  # W; only the ratio matters, runtime rescales
    ld.shadow_soft_size = radius
    lo = bpy.data.objects.new("lamp", ld)
    lo.location = app_to_blender(*pos)
    scene.collection.objects.link(lo)
    lights.append(lo)
lamp = do_bake("lamp", {"DIRECT", "INDIRECT"})
clear_lights()

# 3) Sun bounce: indirect only, averaged over the arc.
sun = np.zeros_like(sky)
for d in SUN_DIRS:
    ld = bpy.data.lights.new("sun", "SUN")
    ld.energy = math.pi  # irradiance π  →  map = radiance / albedo for a three.js light of 1
    ld.angle = math.radians(1.0)
    lo = bpy.data.objects.new("sun", ld)
    v = app_to_blender(*d) - app_to_blender(0, 0, 0)
    lo.rotation_euler = v.normalized().to_track_quat("Z", "Y").to_euler()
    scene.collection.objects.link(lo)
    lights.append(lo)
    sun += do_bake("sun", {"INDIRECT"}) / len(SUN_DIRS)
    clear_lights()

log(f"total bake {time.time() - t0:.1f}s")


# --- denoise (OIDN via the compositor) ---------------------------------------------
def save_exr(arr, path):
    img = bpy.data.images.new(os.path.basename(path), RES, RES, alpha=False, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    rgba = np.concatenate([arr, np.ones((RES, RES, 1), np.float32)], axis=2)
    img.pixels[:] = rgba.ravel()
    img.filepath_raw = path
    img.file_format = "OPEN_EXR"
    img.save()
    return img


def denoise(arr, name):
    src = save_exr(arr, os.path.join(OUT, f"{name}_raw.exr"))
    ds = bpy.data.scenes.new("denoise")
    ds.render.engine = "BLENDER_WORKBENCH"
    ds.render.resolution_x = RES
    ds.render.resolution_y = RES
    ds.render.resolution_percentage = 100
    ds.render.image_settings.file_format = "OPEN_EXR"
    ds.render.image_settings.color_depth = "32"
    ds.view_settings.view_transform = "Standard"
    ds.display_settings.display_device = "sRGB"
    ds.sequencer_colorspace_settings.name = "Non-Color"
    ds.use_nodes = True
    nt = ds.node_tree
    nt.nodes.clear()
    inp = nt.nodes.new("CompositorNodeImage")
    inp.image = src
    dn = nt.nodes.new("CompositorNodeDenoise")
    dn.use_hdr = True
    dn.prefilter = "NONE"
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(inp.outputs["Image"], dn.inputs["Image"])
    nt.links.new(dn.outputs["Image"], comp.inputs["Image"])
    ds.render.filepath = os.path.join(OUT, f"{name}.exr")
    bpy.ops.render.render(write_still=True, scene=ds.name)
    res = bpy.data.images.load(ds.render.filepath)
    res.colorspace_settings.name = "Non-Color"
    out = np.array(res.pixels[:], dtype=np.float32).reshape(RES, RES, 4)[..., :3].copy()
    bpy.data.scenes.remove(ds)
    if not np.isfinite(out).all() or out.max() <= 0:
        log(f"denoise of {name} failed, using raw")
        return arr
    return out


t = time.time()
sky_d = denoise(sky, "sky")
lamp_d = denoise(lamp, "lamp")
sun_d = denoise(sun, "sun")
log(f"denoise {time.time() - t:.1f}s")

# Keep texels the bake never touched (outside every island + margin) at their
# dilated values — EXTEND margin already filled the gutters.


# --- pack ------------------------------------------------------------------------
def lum(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def robust_max(a, q=99.8):
    v = a[a > 1e-4]
    return float(np.percentile(v, q)) if v.size else 1.0


def encode(a):  # linear → sRGB 8-bit
    a = np.clip(a, 0, 1)
    s = np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)
    return np.round(s * 255).astype(np.uint8)


sky_scale = max(1.0, robust_max(sky_d.max(axis=2)))
lamp_l = lum(lamp_d)
sun_l = lum(sun_d)
lamp_scale = robust_max(lamp_l, 99.5)
sun_scale = robust_max(sun_l, 99.8)


def save_png(rgb8, path):
    img = bpy.data.images.new(os.path.basename(path), RES, RES, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    rgba = np.concatenate([rgb8, np.full((RES, RES, 1), 255, np.uint8)], axis=2).astype(np.float32) / 255
    img.pixels[:] = rgba.ravel()
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()


save_png(encode(sky_d / sky_scale), os.path.join(OUT, "lm_sky.png"))
aux = np.stack([lamp_l / lamp_scale, sun_l / sun_scale, np.zeros_like(lamp_l)], axis=2)
save_png(encode(aux), os.path.join(OUT, "lm_aux.png"))

meta = {
    "resolution": RES,
    "samples": SAMPLES,
    "sky": {"scale": round(sky_scale, 4)},
    "lamp": {"scale": round(lamp_scale, 4), "energyW": 40.0},
    "sunBounce": {"scale": round(sun_scale, 4)},
    "grass": "#86a463",
    "bakeSeconds": round(time.time() - t0, 1),
}
with open(os.path.join(OUT, "lightmap.json"), "w") as f:
    json.dump(meta, f, indent=2)
log("meta", meta)
log("sky mean (baked texels)", float(sky_d[sky_d.max(axis=2) > 1e-4].mean()))
