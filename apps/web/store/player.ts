import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Audio } from "@/constants/interfaces";

const STORAGE_KEY = "yuki-player";
const LEGACY_STORAGE_KEY = "audioState";

export interface PlayerState {
  audioState: Audio[];
  currentAudio: number;
  audioLoading: boolean;
  audioPlaying: boolean;
  audioVolume: number;

  setQueue: (payload: Audio[] | Audio) => void;
  addItem: (item: Audio) => void;
  deleteItem: (id: string) => void;
  clearQueue: () => void;
  skipNext: (by: number) => void;
  skipPrev: (by: number) => void;
  setLoading: (value: boolean) => void;
  setPlaying: (value: boolean) => void;
  setVolume: (value: number) => void;
  setCurrent: (index: number) => void;
}

/** Dedupe by ID and drop empty entries. This is the Phase 1 fix — keep it. */
function dedupeById(items: (Audio | null | undefined)[]): Audio[] {
  const out: Audio[] = [];
  for (const item of items) {
    if (item && !out.some((a) => a.ID === item.ID)) out.push(item);
  }
  return out;
}

/**
 * Read the pre-Zustand queue, which was stored as a RAW ARRAY under
 * "audioState". Returns null if we've already migrated (the new key exists),
 * if there's nothing to import, or if the stored value is unusable.
 */
export function importLegacyQueue(
  storage: Storage | undefined = typeof window === "undefined"
    ? undefined
    : window.localStorage
): Audio[] | null {
  if (!storage) return null;
  try {
    if (storage.getItem(STORAGE_KEY)) return null; // already migrated
    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    const parsed: unknown = JSON.parse(legacy);
    if (!Array.isArray(parsed)) return null;
    return dedupeById(parsed as Audio[]);
  } catch {
    return null; // malformed data must never break the player
  }
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      audioState: [],
      currentAudio: 0,
      audioLoading: false,
      audioPlaying: false,
      audioVolume: 0.4,

      setQueue: (payload) =>
        set({
          audioState: dedupeById(Array.isArray(payload) ? payload : [payload]),
        }),

      addItem: (item) => {
        if (!item) return;
        const { audioState } = get();
        if (audioState.some((a) => a.ID === item.ID)) return;
        set({ audioState: [...audioState, item] });
      },

      deleteItem: (id) =>
        set({ audioState: get().audioState.filter((a) => a.ID !== id) }),

      clearQueue: () => set({ audioState: [] }),

      skipNext: (by) => set({ currentAudio: get().currentAudio + by }),
      skipPrev: (by) => set({ currentAudio: get().currentAudio - by }),
      setLoading: (value) => set({ audioLoading: value }),
      setPlaying: (value) => set({ audioPlaying: value }),
      setVolume: (value) => set({ audioVolume: value }),
      setCurrent: (index) => set({ currentAudio: index }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only the queue is persisted — matches the old behavior exactly.
      // Volume/playing/current were never saved and must not start being.
      partialize: (state) => ({ audioState: state.audioState }),
      // Never touch localStorage during SSR; the client rehydrates on mount.
      skipHydration: true,
    }
  )
);

/**
 * Rehydrate on the client, importing a legacy queue on first run so existing
 * users don't lose their playlist. Idempotent.
 */
export async function hydratePlayer(): Promise<void> {
  const legacy = importLegacyQueue();
  await usePlayerStore.persist.rehydrate();
  if (legacy) {
    usePlayerStore.setState({ audioState: legacy });
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}
