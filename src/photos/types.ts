/**
 * Shared contract between the React UI and the native PhotoKit bridge.
 * Both sides code against this file — do not change it without updating both.
 */

export interface PhotoAsset {
  /** PHAsset.localIdentifier — the stable handle used for delete requests. */
  id: string;
  /** Pixel dimensions of the original asset. */
  width: number;
  height: number;
  /** Creation date, ms since epoch. */
  creationDate: number;
  /** Byte size of the original resource, 0 if unavailable. */
  byteSize: number;
  mediaType: 'image' | 'video';
  /** Seconds, only meaningful for videos. */
  duration: number;
  /** True if the asset lives only in iCloud and needs a download to view full-res. */
  isCloudOnly: boolean;
  /** PHAssetMediaSubtype.photoScreenshot — screenshots are prime cleanup targets. */
  isScreenshot: boolean;
  /** PHAsset.isFavorite — kept in sync by setFavorite(). */
  isFavorite: boolean;
}

export interface PermissionStatus {
  /**
   * 'limited' means the user granted access to a subset of photos only.
   * Deletion still works, but only over the selected subset.
   */
  status: 'granted' | 'limited' | 'denied' | 'notDetermined';
}

/**
 * Deck filters.
 *
 * COST NOTE — read before implementing:
 *  - mediaType, dateFrom/dateTo and screenshotsOnly are CHEAP. They map to an
 *    NSPredicate on the PHFetchOptions and are evaluated by PhotoKit itself.
 *  - minByteSize/maxByteSize and sortBy: 'size' are EXPENSIVE. PHAsset exposes
 *    no file size to NSPredicate, so the plugin must build a size index first
 *    (see buildSizeIndex). Never attempt to size-filter by materializing every
 *    asset inline during a listPhotos call.
 */
export interface PhotoFilters {
  /** Omit or 'all' for everything. */
  mediaType?: 'all' | 'image' | 'video';
  /** Inclusive lower bound on creationDate, ms since epoch. */
  dateFrom?: number;
  /** Inclusive upper bound on creationDate, ms since epoch. */
  dateTo?: number;
  /** Restrict the deck to screenshots only. */
  screenshotsOnly?: boolean;
  /** Inclusive lower bound on byteSize. Requires the size index. */
  minByteSize?: number;
  /** Inclusive upper bound on byteSize. Requires the size index. */
  maxByteSize?: number;
}

export interface ListPhotosOptions extends PhotoFilters {
  /** Zero-based offset into the FILTERED result set. */
  offset: number;
  limit: number;
  /** Defaults to 'date'. 'size' requires the size index to be built. */
  sortBy?: 'date' | 'size';
  /**
   * For sortBy 'date': 'newest' = creationDate descending.
   * For sortBy 'size': 'newest' maps to largest-first, 'oldest' to smallest-first.
   */
  sortOrder?: 'newest' | 'oldest';
}

export interface ListPhotosResult {
  assets: PhotoAsset[];
  /** Total count matching the current filters. */
  total: number;
  /**
   * True when the request needed the size index but it is not ready yet.
   * The UI should show a progress state and retry rather than treat the
   * (unfiltered/date-sorted) fallback result as final.
   */
  sizeIndexPending?: boolean;
}

export interface SizeIndexStatus {
  state: 'absent' | 'building' | 'ready';
  /** Assets measured so far. */
  indexed: number;
  /** Total assets to measure. */
  total: number;
}

export interface SetFavoriteOptions {
  id: string;
  favorite: boolean;
}

export interface ThumbnailOptions {
  id: string;
  /** Target width in points; the plugin picks a fitting thumbnail. */
  targetWidth: number;
}

export interface ThumbnailResult {
  /** Fully-formed `data:image/jpeg;base64,...` URL, ready for an <img src>. */
  dataUrl: string;
}

export type Language = 'vi' | 'en';

/**
 * Default review-album name per language, applied on FIRST LAUNCH only.
 * Switching language later must NOT rename the album — the album already
 * exists on device and renaming would orphan the user's collected photos.
 */
export const REVIEW_ALBUM_BY_LANG: Record<Language, string> = {
  vi: 'Chờ xoá',
  en: 'To Delete',
};

/** Name of the review album the app collects swipe-left photos into. */
export const REVIEW_ALBUM = REVIEW_ALBUM_BY_LANG.vi;

export interface AlbumOptions {
  /** Album title. Defaults to REVIEW_ALBUM. */
  albumName?: string;
}

export interface AddToAlbumOptions extends AlbumOptions {
  /** localIdentifiers to add. The album is created on first use. */
  ids: string[];
}

export interface AddToAlbumResult {
  /** Ids actually added (already-present ids are skipped, not duplicated). */
  addedIds: string[];
  albumName: string;
  /** Total assets in the album after the change. */
  albumCount: number;
}

export interface RemoveFromAlbumOptions extends AlbumOptions {
  /** Removes from the album only — the photos stay in the library. */
  ids: string[];
}

export interface RemoveFromAlbumResult {
  removedIds: string[];
  albumCount: number;
}

export interface AlbumAssetsResult {
  assets: PhotoAsset[];
  /** False when the album does not exist yet. */
  exists: boolean;
}

export interface DeletePhotosOptions {
  /** localIdentifiers to delete. iOS shows ONE system confirm dialog for the batch. */
  ids: string[];
}

export interface DeletePhotosResult {
  /** False when the user cancelled the system confirmation dialog. */
  confirmed: boolean;
  deletedIds: string[];
}

/**
 * The native plugin surface. Implemented by:
 *  - ios/App/App/PhotoLibraryPlugin.swift (real PhotoKit)
 *  - src/photos/webMock.ts (browser fallback so `npm run dev` works on desktop)
 */
export interface PhotoLibraryPlugin {
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  listPhotos(options: ListPhotosOptions): Promise<ListPhotosResult>;
  getThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult>;
  /** Full-resolution (screen-sized) image, used for the zoomed detail view. */
  getFullImage(options: ThumbnailOptions): Promise<ThumbnailResult>;
  /** Primary swipe-left action: collect into the review album (reversible). */
  addToAlbum(options: AddToAlbumOptions): Promise<AddToAlbumResult>;
  /** Un-mark: take the asset back out of the review album. */
  removeFromAlbum(options: RemoveFromAlbumOptions): Promise<RemoveFromAlbumResult>;
  /** Contents of the review album, for the in-app review screen. */
  getAlbumAssets(options: AlbumOptions): Promise<AlbumAssetsResult>;
  /** Final, explicit step — only ever called from the review screen. */
  deletePhotos(options: DeletePhotosOptions): Promise<DeletePhotosResult>;
  /** Swipe up: toggles PHAsset.isFavorite. */
  setFavorite(options: SetFavoriteOptions): Promise<void>;
  /**
   * Starts (or resumes) the background scan that measures every asset's
   * byteSize. Safe to call repeatedly — a no-op while already building or ready.
   */
  buildSizeIndex(): Promise<SizeIndexStatus>;
  /** Poll this while state is 'building' to drive a progress bar. */
  getSizeIndexStatus(): Promise<SizeIndexStatus>;
  /** Opens iOS Settings so the user can upgrade from denied/limited access. */
  openSettings(): Promise<void>;
}

/**
 * UI-side verdict for a swiped card.
 *  keep     — swipe right (or left if mirrored): leave the photo alone.
 *  trash    — swipe left: collect into the review album. Reversible.
 *  favorite — swipe up: mark as favourite in Photos AND keep.
 *  later    — swipe down: skip for now, requeue at the end of the deck.
 *             Purely client-side; never touches the library.
 */
export type Verdict = 'keep' | 'trash' | 'favorite' | 'later';

/** User preferences, persisted in localStorage under `photoswipe.settings`. */
export interface Settings {
  /** UI language. Seeded from the device locale on first launch. */
  language: Language;
  /**
   * Which direction means "trash".
   * 'left' (default) → swipe left = cho vào album chờ xoá, swipe right = giữ.
   * 'right' → mirrored, for left-handed users.
   */
  trashDirection: 'left' | 'right';
  /** Active deck filters. */
  filters: PhotoFilters;
  /** Deck ordering. */
  sortBy: 'date' | 'size';
  sortOrder: 'newest' | 'oldest';
  /** Album that swipe-to-trash collects into. */
  albumName: string;
  /** Haptic feedback on each committed swipe. */
  haptics: boolean;
  /** Enable swipe up = favourite, swipe down = later. */
  verticalSwipes: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'vi',
  trashDirection: 'left',
  filters: { mediaType: 'all' },
  sortBy: 'date',
  sortOrder: 'newest',
  albumName: REVIEW_ALBUM,
  haptics: true,
  verticalSwipes: true,
};
