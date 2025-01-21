import { create } from "zustand";

class Sound {
  constructor(url, options = {}) {
    if (typeof window !== "undefined") {
      this.audio = new Audio(url);
      this.audio.volume = 0;
      this.audio.loop = options.loop ?? false;
      this.targetVolume = options.volume ?? 1;
      this.fadeTime = options.fadeTime ?? 1000; // Fade time in milliseconds
    }
  }

  async fadeIn() {
    if (!this.audio) return;

    this.audio.volume = 0;
    await this.audio.play();

    const steps = 60; // Fade steps
    const stepTime = this.fadeTime / steps;
    const volumeStep = this.targetVolume / steps;

    for (let i = 0; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, stepTime));
      this.audio.volume = Math.min(volumeStep * i, this.targetVolume);
    }
  }

  async fadeOut() {
    if (!this.audio) return;

    const startVolume = this.audio.volume;
    const steps = 60;
    const stepTime = this.fadeTime / steps;
    const volumeStep = startVolume / steps;

    for (let i = steps; i >= 0; i--) {
      await new Promise((resolve) => setTimeout(resolve, stepTime));
      this.audio.volume = volumeStep * i;
    }

    this.audio.pause();
    this.audio.currentTime = 0;
  }

  play() {
    if (!this.audio) return;
    if (!this.audio.loop) {
      this.audio.currentTime = 0;
    }
    return this.fadeIn();
  }

  stop() {
    if (!this.audio) return;
    return this.fadeOut();
  }

  setVolume(volume, immediate = false) {
    if (!this.audio) return;
    this.targetVolume = Math.max(0, Math.min(1, volume));

    if (immediate) {
      this.audio.volume = this.targetVolume;
    } else {
      // Only adjust current volume if audio is playing
      if (!this.audio.paused) {
        this.fadeIn();
      }
    }
  }
}

const createSounds = () => {
  if (typeof window === "undefined") return {};

  return {
    swoosh: new Sound("/assets/sounds/swoosh.mp3", {
      volume: 0.1,
      fadeTime: 200,
    }),
    ambient: new Sound("/assets/sounds/ambient.mp3", {
      volume: 0.05,
      loop: true,
      fadeTime: 1000,
    }),
  };
};

const controller = new AbortController();

const useSoundStore = create((set, get) => ({
  isSoundEnabled: true,
  volume: 0.1,
  sounds: {},
  isInitialized: false,

  initialize: () => {
    if (typeof window === "undefined" || get().isInitialized) return;

    const sounds = createSounds();
    set({ sounds, isInitialized: true });

    Object.values(sounds).forEach((sound) => {
      if (sound.audio) sound.audio.load();
    });

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          get().stopAllSounds();
        } else if (get().isSoundEnabled) {
          sounds.ambient?.play();
        }
      },
      { signal: controller.signal }
    );

    window.addEventListener(
      "beforeunload",
      () => {
        get().stopAllSounds();
      },
      { signal: controller.signal }
    );

    window.addEventListener(
      "pagehide",
      () => {
        get().stopAllSounds();
      },
      { signal: controller.signal }
    );
  },

  stopAllSounds: async () => {
    const promises = Object.values(get().sounds).map((sound) => sound?.stop());
    await Promise.all(promises);
  },

  setSoundEnabled: (enabled) => {
    const state = get();
    set({ isSoundEnabled: enabled });

    if (typeof window === "undefined") return;

    if (!state.isInitialized) {
      state.initialize();
    }

    if (enabled) {
      const ambient = state.sounds.ambient;
      if (ambient) {
        ambient.setVolume(state.volume * 0.3);
        ambient.play();
      }
    } else {
      state.stopAllSounds();
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

    if (!state.isInitialized) {
      state.initialize();
    }

    const sound = state.sounds[soundId];
    if (sound) {
      sound.play();
    }
  },

  stopSound: (soundId) => {
    if (typeof window === "undefined") return;

    const sound = get().sounds[soundId];
    if (sound) {
      sound.stop();
    }
  },

  cleanup: () => {
    if (typeof window === "undefined") return;

    controller.abort();
    get().stopAllSounds();
    set({ isInitialized: false });
  },
}));

export default useSoundStore;
