import { create } from "zustand";
import useCameraStore from "./cameraStore";
import useMoosStore from "./moosStore";

/**
 * Sound via Howler (Web Audio): real gain nodes, so volume and fades also work
 * on iOS (HTMLAudio ignores .volume there), overlapping swooshes don't cut each
 * other off and fades run on the audio clock.
 *
 * Every sound ships as Opus (webm) with an mp3 fallback; Howler picks the
 * first one the browser can play. Howler itself is loaded lazily in initialize.
 */
const SRC = (name) => [`/assets/sounds/${name}.webm`, `/assets/sounds/${name}.mp3`];

const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const SOUNDS = {
  swoosh: () => ({ src: SRC("swoosh"), volume: isMobile() ? 0.3 : 0.2 }),
  ambient: () => ({ src: SRC("ambient"), volume: isMobile() ? 0.03 : 0.05, loop: true, preload: false }),
  pageTurn: () => ({ src: SRC("pageflip"), volume: 0.1 }),
  // Placeholder chirps (synthesized); swap the files, keep or update the offsets.
  birds: () => ({
    src: SRC("birds"),
    volume: 0.04,
    sprite: {
      robin: [0, 550],
      tit: [800, 550],
      cheep: [1600, 240],
      blackbird: [2090, 650],
      tweet: [2990, 110],
      trill: [3350, 666],
    },
  }),
};

const BIRD_CALLS = Object.keys(SOUNDS.birds().sprite);

const AMBIENT_FADE = 1000;
const BIRD_GAP = [8000, 25000]; // ms between calls
const BIRD_ANSWER_CHANCE = 0.35; // a second bird replies shortly after

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

let controller = null;
let birdTimer = null;
let initRun = 0; // drops a stale async initialize after cleanup (StrictMode)

const useSoundStore = create((set, get) => ({
  isSoundEnabled: true,
  /** Master volume (0-1), on top of every sound's own mix level. */
  volume: 1,
  sounds: {},
  isInitialized: false,

  initialize: async () => {
    if (typeof window === "undefined" || get().isInitialized) return;
    set({ isInitialized: true });
    const run = ++initRun;

    const { Howl, Howler } = await import("howler");
    if (run !== initRun) return; // cleaned up while loading

    Howler.volume(get().volume);
    const sounds = Object.fromEntries(
      Object.entries(SOUNDS).map(([id, options]) => {
        const config = options();
        return [id, Object.assign(new Howl(config), { baseVolume: config.volume })];
      })
    );
    set({ sounds });

    controller = new AbortController();
    const { signal } = controller;
    document.addEventListener(
      "visibilitychange",
      () => (document.hidden ? get().stopAllSounds() : get().startBeds()),
      { signal }
    );
    window.addEventListener("pagehide", () => get().stopAllSounds(), { signal });

    // Enabled before Howler finished loading (e.g. Sound.jsx on mount).
    get().startBeds();
  },

  /** Looping/background layers: ambient bed + bird scheduler. */
  startBeds: () => {
    const { isSoundEnabled, sounds } = get();
    if (!isSoundEnabled || document.hidden) return;

    const ambient = sounds.ambient;
    if (ambient?.playing()) {
      // Back before a fade-out finished: cancel its stop and fade up again.
      ambient.off("fade");
      ambient.fade(ambient.volume(), ambient.baseVolume, AMBIENT_FADE);
    } else if (ambient) {
      if (ambient.state() === "unloaded") ambient.load();
      const id = ambient.play();
      ambient.fade(0, ambient.baseVolume, AMBIENT_FADE, id);
    }
    if (!birdTimer) get().scheduleBirds();
  },

  scheduleBirds: (delay = rand(...BIRD_GAP)) => {
    clearTimeout(birdTimer);
    birdTimer = setTimeout(() => {
      birdTimer = null;
      const { isSoundEnabled } = get();
      if (!isSoundEnabled || document.hidden) return;
      // Keep quiet over the cinematic reel and while chatting with Moos.
      const busy = useCameraStore.getState().cinematic || useMoosStore.getState().open;
      if (!busy) {
        get().chirp();
        if (Math.random() < BIRD_ANSWER_CHANCE) setTimeout(() => get().chirp(), rand(600, 1800));
      }
      get().scheduleBirds();
    }, delay);
  },

  /** One call from a random bird, somewhere left or right in the garden. */
  chirp: () => {
    const birds = get().sounds.birds;
    if (!birds || !get().isSoundEnabled) return;
    const id = birds.play(pick(BIRD_CALLS));
    birds.rate(rand(0.92, 1.08), id);
    birds.stereo(rand(-0.7, 0.7), id);
    birds.volume(birds.baseVolume * rand(0.5, 1), id);
  },

  stopAllSounds: () => {
    clearTimeout(birdTimer);
    birdTimer = null;
    const ambient = get().sounds.ambient;
    if (ambient?.playing()) {
      ambient.fade(ambient.volume(), 0, AMBIENT_FADE / 2);
      ambient.once("fade", () => ambient.stop());
    }
  },

  setSoundEnabled: (enabled) => {
    set({ isSoundEnabled: enabled });
    if (typeof window === "undefined") return;
    if (!get().isInitialized) get().initialize();

    if (enabled) get().startBeds();
    else get().stopAllSounds();
  },

  setVolume: async (volume) => {
    const normalized = Math.max(0, Math.min(1, volume));
    set({ volume: normalized });
    if (typeof window === "undefined" || !get().isInitialized) return;
    const { Howler } = await import("howler");
    Howler.volume(normalized);
  },

  playSound: (soundId) => {
    const state = get();
    if (!state.isSoundEnabled || typeof window === "undefined") return;
    if (!state.isInitialized) state.initialize();
    state.sounds[soundId]?.play();
  },

  stopSound: (soundId) => {
    get().sounds[soundId]?.stop();
  },

  cleanup: () => {
    if (typeof window === "undefined") return;
    initRun++;
    controller?.abort();
    clearTimeout(birdTimer);
    birdTimer = null;
    Object.values(get().sounds).forEach((sound) => sound.unload());
    set({ sounds: {}, isInitialized: false });
  },
}));

export default useSoundStore;
