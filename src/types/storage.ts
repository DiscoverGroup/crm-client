export type StorageMode = 'cloudflare-r2' | 'local-mac';

export interface LocalMacConfig {
  ip: string;
  port: number;
  token: string;
}

export interface StorageSettings {
  mode: StorageMode;
  localMac: LocalMacConfig;
}

export const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  mode: 'cloudflare-r2',
  localMac: {
    ip: '',
    port: 4041,
    token: '',
  },
};
