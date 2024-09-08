export interface Owner {
  name: string;
  ID: string;
  canonicalURL: string;
  thumbnails?: string[];
}

export interface Audio {
  ID: string;
  URL: string;
  title: string;
  thumbnails: string[];
  owner: Owner;
  audioLengthSec?: number;
  message?: string;
}

// Type for our state
export interface AudioConfigType {
  audioState: Audio[];
  currentAudio: number;
  audioLoading: boolean;
  audioPlaying: boolean;
  audioVolume: number;
}
