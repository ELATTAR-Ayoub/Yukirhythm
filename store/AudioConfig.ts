import { createSlice } from "@reduxjs/toolkit";
import { AppState } from "./store";
import { HYDRATE } from "next-redux-wrapper";

// constants
import { AudioConfigType } from "@/constants/interfaces";

// Initial state
const initialState: AudioConfigType = {
  audioState: [],
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
    },

    DELETE_ARR(state) {
      state.audioState = [];
    },

    ADD_ITEM(state, action) {
      return {
        ...state,
        audioState: [...state.audioState, action.payload],
      };
    },

    DELETE_ITEM(state, action) {
      const index = state.audioState.findIndex(
        (item) => item.ID === action.payload
      );
      if (index === -1) return state;

      const newAudioConfig = [...state.audioState];
      newAudioConfig.splice(index, 1);

      return {
        ...state,
        audioState: newAudioConfig,
      };
    },

    SKIP_NEXT(state, action) {
      return {
        ...state,
        currentAudio: state.currentAudio + action.payload,
      };
    },

    SKIP_PREV(state, action) {
      return {
        ...state,
        currentAudio: state.currentAudio - action.payload,
      };
    },

    SET_LOADING(state, action) {
      return {
        ...state,
        audioLoading: action.payload,
      };
    },

    SET_VOLUME(state, action) {
      return {
        ...state,
        audioVolume: action.payload,
      };
    },

    SET_CURRENT(state, action) {
      return {
        ...state,
        currentAudio: action.payload,
      };
    },

    SET_PLAYING(state, action) {
      return {
        ...state,
        audioPlaying: action.payload,
      };
    },
  },
  // Special reducer for hydrating the state. Special case for next-redux-wrapper
  /* extraReducers: {
      [HYDRATE]: (state: AudioConfig, action: { type: typeof HYDRATE, payload: { audio: AudioConfig } }) => {
        return {
          ...state,
          ...action.payload.audio,
        };
      },
    }, */
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
