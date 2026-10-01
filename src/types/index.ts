export interface Track {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  streamUrl: string;
  duration: number;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  coverArt?: string;
  isLocal: boolean;
  createdAt: number;
}
