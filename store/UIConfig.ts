import { createSlice } from "@reduxjs/toolkit";
import { AppState } from "./store";
import { HYDRATE } from "next-redux-wrapper";

// Type for our state
export interface UIState {
  MenuToggle: boolean;
  Loading: boolean;
}

// Initial state
const initialState: UIState = {
  MenuToggle: false,
  Loading: false,
};

// Actual Slice
export const UIConfigSlice = createSlice({
  name: "UIConfigSlice",
  initialState,
  reducers: {
    // Action to set the user status
    setUIState(state, action) {
      state = action.payload;
    },

    setMenuToggle(state, action) {
      state.MenuToggle = action.payload;
    },

    setLoading(state, action) {
      state.Loading = action.payload;
    },
  },
});

export const { setUIState, setMenuToggle, setLoading } = UIConfigSlice.actions;

export const selectUIState = (state: AppState) => state.UIConfig;
export const selectMenuToggle = (state: AppState) => state.UIConfig.MenuToggle;
export const selectLoading = (state: AppState) => state.UIConfig.Loading;

export default UIConfigSlice.reducer;
