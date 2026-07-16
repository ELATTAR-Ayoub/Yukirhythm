import { createSlice } from "@reduxjs/toolkit";
import { AppState } from "./store";

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
    setMenuToggle(state, action) {
      state.MenuToggle = action.payload;
    },
  },
});

export const { setMenuToggle } = UIConfigSlice.actions;

export const selectMenuToggle = (state: AppState) => state.UIConfig.MenuToggle;

export default UIConfigSlice.reducer;
