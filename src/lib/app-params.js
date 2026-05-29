// Legacy module — Base44-specific app params are no longer needed since the
// backend moved to our local Express server. This file is kept only because a
// handful of components still import from it; it returns empty defaults.

export const appParams = {
  appId: '',
  token: null,
  fromUrl: typeof window !== 'undefined' ? window.location.href : '',
  functionsVersion: undefined,
  appBaseUrl: '',
};
