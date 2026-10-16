/*
 * Moos' live body state, shared without React/zustand churn: Moos.jsx writes
 * it every frame, the camera ('moos' shot) and anything else read it.
 * Plain numbers on purpose (no three import, safe for the stores).
 *
 * World space. Studio floor y = -1.87 (measured on studio.glb).
 */
export const MOOS_FLOOR_Y = -1.87;

// Home spot: front-left of the studio next to the boxes and plants, turned
// towards the chat camera. Left on purpose: the desktop chat panel opens
// bottom-right and would cover him there.
export const MOOS_HOME = { x: -1.6, z: 1.15, heading: 0.55 };
// Portrait phones see a much narrower slice of the studio: step in, still left of the table.
export const MOOS_HOME_MOBILE = { x: -0.82, z: 1.85, heading: 0.35 };

export const moosBody = {
  x: MOOS_HOME.x,
  z: MOOS_HOME.z,
  heading: MOOS_HOME.heading, // yaw, 0 = facing +Z (the overview camera)
  speed: 0, // m/s (world)
  walking: false,
};
