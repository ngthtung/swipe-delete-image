import { registerPlugin } from '@capacitor/core';

import type { PhotoLibraryPlugin } from './types';

/**
 * The PhotoLibrary bridge.
 *
 * On iOS this resolves to `ios/App/App/PhotoLibraryPlugin.swift` (real PhotoKit).
 * Everywhere else it lazily loads the browser mock so `npm run dev` works on a
 * desktop without a native shell.
 */
export const PhotoLibrary = registerPlugin<PhotoLibraryPlugin>('PhotoLibrary', {
  web: () => import('./webMock').then((m) => new m.PhotoLibraryWeb()),
});

// Re-exported as a value export: types.ts also carries runtime constants
// (REVIEW_ALBUM, DEFAULT_SETTINGS) that the UI imports from './photos'.
export * from './types';
