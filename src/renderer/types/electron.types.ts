import type { WindowApi } from '../../preload/index';

declare global {
  interface Window {
    crosspdf: WindowApi;
  }
}

export type { WindowApi };
