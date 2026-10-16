import { AnimationMixer, LoopRepeat, Quaternion, Sphere, Vector3 } from "three/webgpu";

/*
 * Runtime side of Moos' rig. The skeleton matches the Quaternius Universal
 * Animation Library (bone names / hierarchy / rest orientations, see
 * scripts/moos/rig_moos.py) and the clips are baked offline
 * (scripts/moos/retarget_anims.py). Here: an AnimationMixer with one action
 * per clip, blended by weight, plus an additive look-at on top.
 */
export const CLIPS = ["idle", "talk", "think", "happy", "wave", "walk"];
export const LOOK_BONES = [
  // share of the look rotation per bone (spine -> neck -> head)
  ["spine_03", 0.15],
  ["neck_01", 0.35],
  ["Head", 0.5],
];
// walk clip ground speed at scale 1 (measured by retarget_anims.py; the GLB
// carries the exact value as extras.moosWalkSpeed on the armature node)
const WALK_SPEED_FALLBACK = 0.76;

export function buildRig(gltf) {
  const bones = {};
  let skinned = null;
  let walkSpeed = WALK_SPEED_FALLBACK;
  gltf.scene.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isSkinnedMesh) skinned = o;
    if (o.userData?.moosWalkSpeed) walkSpeed = o.userData.moosWalkSpeed;
  });
  const mixer = new AnimationMixer(gltf.scene);
  const actions = {};
  for (const name of CLIPS) {
    const clip = gltf.animations.find((c) => c.name === name);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.setLoop(LoopRepeat, Infinity);
    action.enabled = true;
    action.setEffectiveWeight(name === "idle" ? 1 : 0);
    action.play();
    actions[name] = action;
  }
  // Bind-pose bounds don't cover a raised arm or a stride: generous fixed sphere.
  skinned.boundingSphere = new Sphere(new Vector3(0, 0.95, 0), 1.25);
  skinned.computeBoundingSphere = () => {};
  return { bones, skinned, mixer, actions, walkSpeed };
}

const _pq = new Quaternion();
const _d = new Quaternion();

/** Rotate a bone by a WORLD-space rotation q (after the mixer wrote its local pose). */
export function rotateBoneWorld(bone, q) {
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(_pq);
  // world' = q · parentWorld · local  ->  local' = parentWorld⁻¹ · q · parentWorld · local
  _d.copy(_pq).invert().multiply(q).multiply(_pq);
  bone.quaternion.premultiply(_d);
}
