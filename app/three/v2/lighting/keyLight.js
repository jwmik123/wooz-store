import { DirectionalLight } from "three/webgpu";
import { lights } from "three/tsl";

/**
 * The single shadow-casting key light (sun by day, moon by night). Created at
 * module scope so baked materials can reference it before <Lights /> mounts;
 * <Lights /> adds it to the scene and drives it every frame.
 */
export const keyLight = new DirectionalLight(0xffffff, 3);
keyLight.name = "keyLight";
keyLight.castShadow = true;

/**
 * Real-time lights for lightmapped materials (studio shell + garments): only the
 * key light. Sky fill, bounce and the interior lamps come from the lightmap, so
 * the hemisphere + point lights in the scene don't touch these pixels.
 */
export const bakedLightsNode = lights([keyLight]);
