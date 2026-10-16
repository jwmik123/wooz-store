import { MathUtils, Quaternion, Vector3 } from "three/webgpu";

/*
 * Procedural rig helpers for Moos (no animation clips).
 *
 * Every bone is driven by an offset quaternion Q expressed in MODEL space
 * (the armature frame: +Y up, Moos faces +Z, his left hand is +X), relative to
 * the bind pose and carried along by the parent chain (normal FK):
 *
 *   bone.quaternion = rest · C⁻¹ · Q · C        (C = bone's bind orientation in model space)
 *
 * so bone rolls from Blender never matter and poses read like
 * "rotate the right upper arm -100° around Z".
 *
 * Axis cheat-sheet (model space):
 *   X+  pitch forward (spine bends forward, head looks down, forearm X- = hand comes forward)
 *   Y+  turn towards his left (+X)
 *   Z+  roll: raises the LEFT arm / tilts the head to his right; Z- raises the RIGHT arm
 */

const AXES = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };
const _q = new Quaternion();

/** [['z', -100], ['x', -10]] -> quaternion, rotations applied in order (absolute, model axes). */
export function seqToQuat(seq, target = new Quaternion()) {
  target.identity();
  for (const [axis, deg] of seq) {
    _q.setFromAxisAngle(AXES[axis], MathUtils.degToRad(deg));
    target.premultiply(_q);
  }
  return target;
}

export function buildRig(scene) {
  scene.updateMatrixWorld(true);
  const bones = {};
  const order = [];
  let skinned = null;
  scene.traverse((o) => {
    if (o.isBone) {
      bones[o.name] = o;
      order.push(o);
    }
    if (o.isSkinnedMesh) skinned = o;
  });
  const armature = bones.hips.parent;
  const rootInv = armature.getWorldQuaternion(new Quaternion()).invert();
  const info = {};
  for (const b of order) {
    const C = rootInv.clone().multiply(b.getWorldQuaternion(new Quaternion()));
    info[b.name] = {
      bone: b,
      rest: b.quaternion.clone(),
      restPos: b.position.clone(),
      C,
      Cinv: C.clone().invert(),
      parent: b.parent?.isBone ? b.parent.name : null,
    };
  }
  return { bones, info, order: order.map((b) => b.name), armature, skinned };
}

/**
 * Resolve a pose authored as ABSOLUTE model-space rotation sequences per bone
 * (like posing in Blender: parent first, then rotate the child from where it
 * ended up) into parent-carried offsets usable with `applyOffset`.
 */
export function resolvePose(rig, spec) {
  const D = {};
  const out = {};
  const I = new Quaternion();
  for (const name of rig.order) {
    const parentD = D[rig.info[name].parent] || I;
    if (spec[name]) {
      const R = seqToQuat(spec[name]);
      D[name] = R.clone().multiply(parentD);
      out[name] = parentD.clone().invert().multiply(D[name]);
    } else {
      D[name] = parentD;
    }
  }
  return out;
}

const _t = new Quaternion();
/** bone.quaternion = rest · C⁻¹ · Q · C */
export function applyOffset(entry, Q) {
  _t.copy(entry.Cinv).multiply(Q).multiply(entry.C);
  entry.bone.quaternion.copy(entry.rest).multiply(_t);
}
