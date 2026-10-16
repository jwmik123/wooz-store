import { create } from "zustand";

/**
 * Event bridge between the Moos chat (brain/UI) and the 3D Moos (body).
 * The 3D component subscribes (e.g. `useMoosStore(s => s.currentAnimation)`)
 * and never needs to know anything about the chat. See docs/MOOS.md.
 */
export const MOOS_ANIMATIONS = ["idle", "talk", "wave", "think", "happy"];

const useMoosStore = create((set, get) => ({
  open: false, // chat panel open
  isThinking: false, // request sent, no text yet / tools running
  isTalking: false, // assistant text is streaming
  currentAnimation: "idle", // one of MOOS_ANIMATIONS
  lastAction: null, // { type, payload, id, at } - last client action (openCollection, setMood...)
  _override: null, // timer id while a timed animation override is active

  setOpen: (open) => {
    set({ open });
    if (open) get().setAnimation("wave", 2200);
  },
  toggleOpen: () => get().setOpen(!get().open),

  /** Set an animation; with `revertMs` it falls back to the state-derived one. */
  setAnimation: (animation, revertMs) => {
    if (!MOOS_ANIMATIONS.includes(animation)) return;
    clearTimeout(get()._override);
    set({ currentAnimation: animation, _override: null });
    if (revertMs) {
      const t = setTimeout(() => get().syncAnimation(), revertMs);
      set({ _override: t });
    }
  },

  /** Derive animation from the thinking/talking flags. */
  syncAnimation: () => {
    const { isThinking, isTalking } = get();
    set({
      _override: null,
      currentAnimation: isTalking ? "talk" : isThinking ? "think" : "idle",
    });
  },

  setThinking: (isThinking) => {
    set({ isThinking });
    if (!get()._override) get().syncAnimation();
  },
  setTalking: (isTalking) => {
    set({ isTalking });
    if (!get()._override) get().syncAnimation();
  },

  recordAction: (type, payload = {}) =>
    set({ lastAction: { type, payload, id: Date.now(), at: Date.now() } }),
}));

export default useMoosStore;
