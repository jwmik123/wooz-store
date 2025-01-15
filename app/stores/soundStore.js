import { create } from "zustand";

class Sound {
  constructor(url, options = {}) {
    this.audio = new Audio(url);
    this.audio.volume = options.volume ?? 1;
    this.audio.loop = options.loop ?? false;
  }

  play() {
    this.audio.currentTime = 0;
    return this.audio.play().catch((error) => {
      console.warn("Audio playback failed:", error);
    });
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  setVolume(volume) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }
}

const useSoundStore = create((set, get) => ({
  // Sound states
  isSoundEnabled: true,
  volume: 0.1,

  // Sound instances
  sounds: {
    swoosh: new Sound("/assets/sounds/swoosh.mp3", { volume: 0.1 }),
    ambient: new Sound("/assets/sounds/ambient.mp3", {
      volume: 0.1,
      loop: true,
    }),
    // Add more sounds here as needed
  },

  // Methods
  initialize: () => {
    // Preload sounds and set initial states
    Object.values(get().sounds).forEach((sound) => {
      sound.audio.load();
    });
  },

  setSoundEnabled: (enabled) => {
    const state = get();
    set({ isSoundEnabled: enabled });

    // Handle ambient sound
    if (enabled) {
      state.sounds.ambient.setVolume(state.volume * 0.3);
      state.sounds.ambient.play();
    } else {
      state.sounds.ambient.stop();
    }
  },

  setVolume: (volume) => {
    const normalizedVolume = Math.max(0, Math.min(1, volume));
    set({ volume: normalizedVolume });

    // Update all sound volumes
    Object.values(get().sounds).forEach((sound) => {
      sound.setVolume(normalizedVolume);
    });
  },

  playSound: (soundId) => {
    const state = get();
    if (!state.isSoundEnabled) return;

    const sound = state.sounds[soundId];
    if (sound) {
      sound.play();
    }
  },

  stopSound: (soundId) => {
    const sound = get().sounds[soundId];
    if (sound) {
      sound.stop();
    }
  },

  cleanup: () => {
    // Cleanup method for unmounting
    Object.values(get().sounds).forEach((sound) => {
      sound.stop();
    });
  },
}));

export default useSoundStore;
