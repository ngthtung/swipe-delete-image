import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tungnt.photoswipe',
  appName: 'PhotoSwipe',
  webDir: 'dist',
  ios: {
    // The swipe deck is a dark, full-bleed surface.
    backgroundColor: '#000000',
    contentInset: 'always',
  },
};

export default config;
