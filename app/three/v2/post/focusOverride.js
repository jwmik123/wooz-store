/*
 * Focus override for the depth of field (no three imports; the DOM loader
 * animates it with gsap).
 *
 *   amount   0 = autofocus as usual … 1 = focus pinned at `distance`
 *   blur     extra blur multiplier at amount = 1 (lens blur strength × (1 + blur))
 *
 * Used for the intro reveal: the garden starts out of focus (focus pinned just
 * in front of the lens) and racks to the studio as the mist lifts.
 */
export const focusPull = { amount: 0, distance: 0.6, blur: 0.6 };
