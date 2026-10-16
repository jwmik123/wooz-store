/*
 * Key poses, authored as absolute model-space rotation sequences from the bind
 * (A-)pose, see rig.js for the axis cheat-sheet. Procedural motion (breathing,
 * look-at, gestures, waving) is layered on top in Moos.jsx.
 */

// Arms down from the Meshy A-pose, slight elbow bend: the base everything blends from.
export const RELAXED = {
  shoulder_L: [["z", -4]],
  shoulder_R: [["z", 4]],
  upper_arm_L: [["z", -24], ["x", -4]],
  upper_arm_R: [["z", 24], ["x", -4]],
  forearm_L: [["x", -14], ["y", 8]],
  forearm_R: [["x", -14], ["y", -8]],
  hand_L: [["y", 10]],
  hand_R: [["y", -10]],
};

export const POSES = {
  idle: {},

  // right arm up next to the head, forearm oscillates (see Moos.jsx)
  wave: {
    ...RELAXED,
    shoulder_R: [["z", -8]],
    upper_arm_R: [["z", -112], ["x", -12]],
    forearm_R: [["z", -30], ["x", -10]],
    hand_R: [["y", -20]],
    head: [["z", 5]],
  },

  // both hands come up in front for gesturing
  talk: {
    ...RELAXED,
    upper_arm_L: [["z", -20], ["x", -14]],
    upper_arm_R: [["z", 20], ["x", -14]],
    forearm_L: [["x", -55], ["y", 18]],
    forearm_R: [["x", -55], ["y", -18]],
    hand_L: [["y", 30]],
    hand_R: [["y", -30]],
  },

  // right hand to the chin, head tilted and looking up
  think: {
    ...RELAXED,
    upper_arm_R: [["z", 32], ["x", -52], ["y", 30]],
    forearm_R: [["x", -150], ["z", 10]],
    hand_R: [["x", 20]],
    spine2: [["x", 3]],
    head: [["z", 10], ["x", -8]],
  },

  // little "yay": fists up in front, chest open
  happy: {
    ...RELAXED,
    upper_arm_L: [["z", -18], ["x", -22]],
    upper_arm_R: [["z", 18], ["x", -22]],
    forearm_L: [["x", -115], ["z", -12]],
    forearm_R: [["x", -115], ["z", 12]],
    spine2: [["x", -4]],
    head: [["x", -6]],
  },
};
