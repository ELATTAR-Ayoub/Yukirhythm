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

export interface CollectionOwner {
  name: string;
  ID: string;
  docID: string;
  avatar: string;
}

export interface Collection {
  ID: string;
  title: string;
  desc: string;
  thumbnails: string[];
  owner: CollectionOwner;
  audio: Audio[];
  likes: number;
  tags: string[];
  date: string;
  private: Boolean;
  collectionLengthSec?: number;
}

export interface User {
  ID: string;
  docID: string;
  avatar: string;
  userName: string;
  email: string;
  marketingEmails: boolean;
  lovedSongs: Audio[];
  collections: string[]; //just IDs
  lovedCollections: string[]; //just IDs
  followers: string[];
  following: string[];
}
