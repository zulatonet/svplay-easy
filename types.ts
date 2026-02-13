
export interface IPTVItem {
  id: string;
  name: string;
  logo: string;
  url: string;
  group: string;
  type: 'live' | 'movie' | 'series';
  tvgId?: string;
}

export interface PlaylistData {
  name: string;
  items: IPTVItem[];
  categories: string[];
  updatedAt: number;
  pin: string;
}

export interface SyncMessage {
  type: 'PLAY_CONTENT' | 'STOP_CONTENT' | 'VOLUME_CHANGE' | 'PING';
  payload: any;
  pin: string;
}

export enum AppRoute {
  HOME = '/',
  CONTROLLER = '/controller',
  PLAYOUT = '/play'
}
