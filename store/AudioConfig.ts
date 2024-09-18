import { createSlice } from "@reduxjs/toolkit";
import { AppState } from "./store";
import { AudioConfigType } from "@/constants/interfaces";

// Helper function to load from localStorage
const loadFromLocalStorage = () => {
  try {
    const serializedState = localStorage.getItem("audioState");
    if (serializedState === null) {
      return []; // No saved audio state
    }
    return JSON.parse(serializedState);
  } catch (e) {
    console.warn("Failed to load state from localStorage", e);
    return [];
  }
};

// Helper function to save to localStorage
const saveToLocalStorage = (state: AudioConfigType) => {
  try {
    const serializedState = JSON.stringify(state.audioState);
    localStorage.setItem("audioState", serializedState);
  } catch (e) {
    console.warn("Failed to save state to localStorage", e);
  }
};

// Initial state with localStorage
const initialState: AudioConfigType = {
  audioState: loadFromLocalStorage(), // Load from localStorage on init
  currentAudio: 0,
  audioLoading: false,
  audioPlaying: false,
  audioVolume: 0.4,
};

// Actual Slice
export const AudioConfig = createSlice({
  name: "audio",
  initialState,
  reducers: {
    // Action to set the audio status
    setAudioConfig(state, action) {
      if (Array.isArray(action.payload)) {
        state.audioState = [...action.payload];
      } else {
        state.audioState = [action.payload];
      }
      saveToLocalStorage(state); // Save to localStorage
    },

    DELETE_ARR(state) {
      state.audioState = [];
      saveToLocalStorage(state); // Save empty array to localStorage
    },

    ADD_ITEM(state, action) {
      state.audioState = [...state.audioState, action.payload];
      saveToLocalStorage(state); // Save updated array to localStorage
    },

    DELETE_ITEM(state, action) {
      const index = state.audioState.findIndex(
        (item) => item.ID === action.payload
      );
      if (index !== -1) {
        state.audioState.splice(index, 1);
      }
      saveToLocalStorage(state); // Save updated array to localStorage
    },

    SKIP_NEXT(state, action) {
      state.currentAudio = state.currentAudio + action.payload;
    },

    SKIP_PREV(state, action) {
      state.currentAudio = state.currentAudio - action.payload;
    },

    SET_LOADING(state, action) {
      state.audioLoading = action.payload;
    },

    SET_VOLUME(state, action) {
      state.audioVolume = action.payload;
    },

    SET_CURRENT(state, action) {
      state.currentAudio = action.payload;
    },

    SET_PLAYING(state, action) {
      state.audioPlaying = action.payload;
    },
  },
});

export const {
  setAudioConfig,
  SET_CURRENT,
  ADD_ITEM,
  DELETE_ITEM,
  SKIP_NEXT,
  SKIP_PREV,
  SET_LOADING,
  SET_PLAYING,
  SET_VOLUME,
  DELETE_ARR,
} = AudioConfig.actions;

export const selectAudioConfig = (state: AppState) =>
  state.AudioConfig.audioState;

export const selectCurrentAudio = (state: AppState) =>
  state.AudioConfig.currentAudio;

export const selectAudioLoading = (state: AppState) =>
  state.AudioConfig.audioLoading;

export const selectAudioPlaying = (state: AppState) =>
  state.AudioConfig.audioPlaying;

export const selectAudioVolume = (state: AppState) =>
  state.AudioConfig.audioVolume;

export default AudioConfig.reducer;
