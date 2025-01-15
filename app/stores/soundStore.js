import { create } from "zustand";

class Sound {
  constructor(url, options = {}) {
    if (typeof window !== "undefined") {
      this.audio = new Audio(url);
      this.audio.volume = options.volume ?? 1;
      this.audio.loop = options.loop ?? false;
    }
  }

  play() {
    if (!this.audio) return;
    this.audio.currentTime = 0;
    return this.audio.play().catch((error) => {
      console.warn("Audio playback failed:", error);
    });
  }

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  setVolume(volume) {
    if (!this.audio) return;
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }
}

const createSounds = () => {
  if (typeof window === "undefined") return {};

  return {
    swoosh: new Sound("/assets/sounds/swoosh.mp3", { volume: 0.1 }),
    ambient: new Sound("/assets/sounds/ambient.mp3", {
      volume: 0.1,
      loop: true,
    }),
  };
};

const useSoundStore = create((set, get) => ({
  isSoundEnabled: true,
  volume: 0.1,
  sounds: {},

  initialize: () => {
    if (typeof window === "undefined") return;

    set({ sounds: createSounds() });

    Object.values(get().sounds).forEach((sound) => {
      if (sound.audio) sound.audio.load();
    });

    // Handle page visibility change
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        get().stopAllSounds();
      }
    });

    // Handle page unload
    window.addEventListener("beforeunload", () => {
      get().stopAllSounds();
    });

    // Handle mobile back button and tab closing
    window.addEventListener("pagehide", () => {
      get().stopAllSounds();
    });
  },

  stopAllSounds: () => {
    Object.values(get().sounds).forEach((sound) => {
      sound?.stop();
    });
  },

  setSoundEnabled: (enabled) => {
    const state = get();
    set({ isSoundEnabled: enabled });

    if (typeof window === "undefined") return;

    if (enabled) {
      state.sounds.ambient?.setVolume(state.volume * 0.3);
      state.sounds.ambient?.play();
    } else {
      state.sounds.ambient?.stop();
    }
  },

  setVolume: (volume) => {
    const normalizedVolume = Math.max(0, Math.min(1, volume));
    set({ volume: normalizedVolume });

    if (typeof window === "undefined") return;

    Object.values(get().sounds).forEach((sound) => {
      sound?.setVolume(normalizedVolume);
    });
  },

  playSound: (soundId) => {
    const state = get();
    if (!state.isSoundEnabled || typeof window === "undefined") return;

    const sound = state.sounds[soundId];
    sound?.play();
  },

  stopSound: (soundId) => {
    if (typeof window === "undefined") return;

    const sound = get().sounds[soundId];
    sound?.stop();
  },

  cleanup: () => {
    if (typeof window === "undefined") return;

    // Remove event listeners
    document.removeEventListener("visibilitychange", get().stopAllSounds);
    window.removeEventListener("beforeunload", get().stopAllSounds);
    window.removeEventListener("pagehide", get().stopAllSounds);

    // Stop all sounds
    get().stopAllSounds();
  },
}));

export default useSoundStore;
