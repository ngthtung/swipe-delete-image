import { WebPlugin } from '@capacitor/core';

import { REVIEW_ALBUM } from './types';
import type {
  AddToAlbumOptions,
  AddToAlbumResult,
  AlbumAssetsResult,
  AlbumOptions,
  DeletePhotosOptions,
  DeletePhotosResult,
  ListPhotosOptions,
  ListPhotosResult,
  PermissionStatus,
  PhotoAsset,
  PhotoLibraryPlugin,
  RemoveFromAlbumOptions,
  RemoveFromAlbumResult,
  SetFavoriteOptions,
  SizeIndexStatus,
  ThumbnailOptions,
  ThumbnailResult,
} from './types';

/** How many fake assets the mock library holds. */
const ASSET_COUNT = 60;
/** Fake native round-trip, so the UI's loading states are exercised in dev. */
const LATENCY_MS = 80;
/** How long the simulated size-index scan takes, end to end. */
const SIZE_INDEX_DURATION_MS = 2000;
const SIZE_INDEX_TICK_MS = 100;
/** 1x1 grey JPEG, used when no 2D canvas context is available (e.g. SSR). */
const FALLBACK_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////' +
  '////////////////////////////////////////////////////2wBDAf//////////////////' +
  '////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQ' +
  'ABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAA' +
  'X/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

/** Deterministic PRNG so every reload renders the exact same fake library. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A few plausible camera aspect ratios, picked deterministically per index. */
const SHAPES: ReadonlyArray<readonly [number, number]> = [
  [4032, 3024],
  [3024, 4032],
  [1920, 1080],
  [1080, 1920],
  [2048, 2048],
  [3000, 2000],
];
/** Screenshots are phone-screen shaped. */
const SCREENSHOT_SHAPE: readonly [number, number] = [1179, 2556];

/** Newest asset in the fake library; the rest fan out backwards ~3 years. */
const NEWEST_AT = Date.UTC(2026, 8, 1);
const LIBRARY_SPAN_MS = 3 * 365 * 24 * 60 * 60 * 1000;

function buildAsset(index: number): PhotoAsset {
  const rnd = mulberry32(Math.imul(index + 1, 2654435761));
  const isVideo = index % 7 === 3;
  // Roughly a third of the library is screenshots — the prime cleanup target.
  const isScreenshot = !isVideo && index % 3 === 1;
  const [w, h] = isScreenshot ? SCREENSHOT_SHAPE : SHAPES[index % SHAPES.length];

  // Spread over ~3 years, newest first, with a little jitter so the dates are
  // not perfectly regular.
  const creationDate = Math.round(
    NEWEST_AT - (index / ASSET_COUNT) * LIBRARY_SPAN_MS - rnd() * 12 * 60 * 60 * 1000,
  );

  // Wide spread so min/max byte-size filters have something to bite on:
  // screenshots ~0.3-1 MB, photos ~1-6 MB, videos ~10-120 MB.
  let byteSize: number;
  if (isVideo) {
    byteSize = Math.round((10 + rnd() * 110) * 1024 * 1024);
  } else if (isScreenshot) {
    byteSize = Math.round((0.3 + rnd() * 0.7) * 1024 * 1024);
  } else {
    byteSize = Math.round((1 + rnd() * 5) * 1024 * 1024);
  }

  return {
    id: `mock-asset-${String(index).padStart(4, '0')}`,
    width: w,
    height: h,
    creationDate,
    byteSize,
    mediaType: isVideo ? 'video' : 'image',
    duration: isVideo ? Math.round((3 + rnd() * 120) * 10) / 10 : 0,
    isCloudOnly: index % 5 === 2,
    isScreenshot,
    isFavorite: index % 11 === 4,
  };
}

/**
 * Browser fallback for the PhotoLibrary bridge.
 *
 * Synthesises a stable fake library with canvas-drawn placeholder thumbnails —
 * no network access — so the swipe UI can be developed on a desktop. The size
 * index is simulated with a timer so the UI's progress bar is exercised for
 * real, including the `sizeIndexPending` fallback path.
 */
export class PhotoLibraryWeb extends WebPlugin implements PhotoLibraryPlugin {
  /** Mock library, newest-first. Mutated by deletePhotos. */
  private library: PhotoAsset[] = Array.from({ length: ASSET_COUNT }, (_, i) => buildAsset(i));
  /** Stable draw seed per id, so a thumbnail keeps its look after deletions. */
  private readonly drawIndexById = new Map<string, number>(
    Array.from({ length: ASSET_COUNT }, (_, i) => [`mock-asset-${String(i).padStart(4, '0')}`, i]),
  );
  /** albumName -> ordered set of asset ids. Mirrors PHAssetCollection membership. */
  private readonly albums = new Map<string, Set<string>>();
  /** Memoised data URLs, keyed by `${id}@${width}`. */
  private readonly renderCache = new Map<string, string>();

  private sizeIndexState: SizeIndexStatus['state'] = 'absent';
  private sizeIndexed = 0;
  private sizeIndexTotal = 0;
  private sizeIndexTimer: ReturnType<typeof setInterval> | undefined;

  async checkPermissions(): Promise<PermissionStatus> {
    await delay(LATENCY_MS / 4);
    return { status: 'granted' };
  }

  async requestPermissions(): Promise<PermissionStatus> {
    await delay(LATENCY_MS / 2);
    return { status: 'granted' };
  }

  async listPhotos(options: ListPhotosOptions): Promise<ListPhotosResult> {
    await delay(LATENCY_MS);
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const limit = Math.max(0, Math.trunc(options.limit ?? 0));
    const sortBy = options.sortBy ?? 'date';
    const descending = (options.sortOrder ?? 'newest') === 'newest';

    // Cheap filters — the native side pushes these into an NSPredicate.
    let matched = this.library.filter((asset) => {
      const mediaType = options.mediaType ?? 'all';
      if (mediaType !== 'all' && asset.mediaType !== mediaType) return false;
      if (options.dateFrom !== undefined && asset.creationDate < options.dateFrom) return false;
      if (options.dateTo !== undefined && asset.creationDate > options.dateTo) return false;
      if (options.screenshotsOnly === true && !asset.isScreenshot) return false;
      return true;
    });

    // `library` is stored newest-first, so 'oldest' walks it backwards.
    matched = descending ? matched : [...matched].reverse();

    const needsSizeIndex =
      sortBy === 'size' || options.minByteSize !== undefined || options.maxByteSize !== undefined;

    if (needsSizeIndex && this.sizeIndexState !== 'ready') {
      // Best available answer, flagged so the UI retries instead of trusting it.
      return {
        assets: matched.slice(offset, offset + limit),
        total: matched.length,
        sizeIndexPending: true,
      };
    }

    if (options.minByteSize !== undefined) {
      const min = options.minByteSize;
      matched = matched.filter((asset) => asset.byteSize >= min);
    }
    if (options.maxByteSize !== undefined) {
      const max = options.maxByteSize;
      matched = matched.filter((asset) => asset.byteSize <= max);
    }
    if (sortBy === 'size') {
      // 'newest' means largest-first for a size sort.
      matched = [...matched].sort((a, b) =>
        descending ? b.byteSize - a.byteSize : a.byteSize - b.byteSize,
      );
    }

    return { assets: matched.slice(offset, offset + limit), total: matched.length };
  }

  async getThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult> {
    await delay(LATENCY_MS);
    return { dataUrl: this.render(options.id, options.targetWidth) };
  }

  async getFullImage(options: ThumbnailOptions): Promise<ThumbnailResult> {
    await delay(LATENCY_MS * 2);
    return { dataUrl: this.render(options.id, options.targetWidth) };
  }

  async addToAlbum(options: AddToAlbumOptions): Promise<AddToAlbumResult> {
    await delay(LATENCY_MS);
    const albumName = this.resolveAlbumName(options.albumName);
    const ids = options.ids ?? [];
    if (ids.length === 0) {
      throw this.unavailable('addToAlbum requires at least one id.');
    }
    // The album is created on first use, mirroring the native behaviour.
    let album = this.albums.get(albumName);
    if (!album) {
      album = new Set<string>();
      this.albums.set(albumName, album);
    }
    const addedIds: string[] = [];
    for (const id of ids) {
      // Unknown ids are skipped, not fatal — matches a `.limited` iOS fetch.
      if (!this.library.some((a) => a.id === id)) continue;
      if (album.has(id)) continue;
      album.add(id);
      addedIds.push(id);
    }
    return { addedIds, albumName, albumCount: album.size };
  }

  async removeFromAlbum(options: RemoveFromAlbumOptions): Promise<RemoveFromAlbumResult> {
    await delay(LATENCY_MS);
    const albumName = this.resolveAlbumName(options.albumName);
    const album = this.albums.get(albumName);
    if (!album) {
      return { removedIds: [], albumCount: 0 };
    }
    const removedIds: string[] = [];
    for (const id of options.ids ?? []) {
      if (album.delete(id)) removedIds.push(id);
    }
    return { removedIds, albumCount: album.size };
  }

  async getAlbumAssets(options: AlbumOptions): Promise<AlbumAssetsResult> {
    await delay(LATENCY_MS);
    const albumName = this.resolveAlbumName(options?.albumName);
    const album = this.albums.get(albumName);
    if (!album) {
      return { assets: [], exists: false };
    }
    // Keep library order (newest-first) rather than insertion order.
    return { assets: this.library.filter((a) => album.has(a.id)), exists: true };
  }

  async deletePhotos(options: DeletePhotosOptions): Promise<DeletePhotosResult> {
    await delay(LATENCY_MS * 3);
    const ids = options.ids ?? [];
    if (ids.length === 0) {
      throw this.unavailable('deletePhotos requires at least one id.');
    }
    const wanted = new Set(ids);
    const deletedIds = this.library.filter((a) => wanted.has(a.id)).map((a) => a.id);
    this.library = this.library.filter((a) => !wanted.has(a.id));
    // A deleted asset must not linger in any album.
    for (const album of this.albums.values()) {
      for (const id of deletedIds) album.delete(id);
    }
    // Keep the simulated index consistent with the shrunken library.
    if (this.sizeIndexState === 'ready') {
      this.sizeIndexed = this.library.length;
      this.sizeIndexTotal = this.library.length;
    }
    return { confirmed: true, deletedIds };
  }

  async setFavorite(options: SetFavoriteOptions): Promise<void> {
    await delay(LATENCY_MS);
    const asset = this.library.find((a) => a.id === options.id);
    if (!asset) {
      throw this.unavailable(`No such asset: ${options.id}`);
    }
    asset.isFavorite = options.favorite;
  }

  async buildSizeIndex(): Promise<SizeIndexStatus> {
    await delay(LATENCY_MS / 2);
    // Idempotent: a no-op while already building or ready.
    if (this.sizeIndexState !== 'absent') {
      return this.snapshotSizeIndex();
    }

    this.sizeIndexState = 'building';
    this.sizeIndexed = 0;
    this.sizeIndexTotal = this.library.length;

    const ticks = Math.max(1, Math.round(SIZE_INDEX_DURATION_MS / SIZE_INDEX_TICK_MS));
    const step = Math.max(1, Math.ceil(this.sizeIndexTotal / ticks));
    this.sizeIndexTimer = setInterval(() => {
      this.sizeIndexed = Math.min(this.sizeIndexTotal, this.sizeIndexed + step);
      if (this.sizeIndexed >= this.sizeIndexTotal) {
        this.sizeIndexState = 'ready';
        if (this.sizeIndexTimer !== undefined) {
          clearInterval(this.sizeIndexTimer);
          this.sizeIndexTimer = undefined;
        }
      }
    }, SIZE_INDEX_TICK_MS);

    return this.snapshotSizeIndex();
  }

  async getSizeIndexStatus(): Promise<SizeIndexStatus> {
    return this.snapshotSizeIndex();
  }

  async openSettings(): Promise<void> {
    console.info('[PhotoLibraryWeb] openSettings() is a no-op in the browser.');
  }

  private snapshotSizeIndex(): SizeIndexStatus {
    return {
      state: this.sizeIndexState,
      indexed: this.sizeIndexed,
      total: this.sizeIndexTotal,
    };
  }

  private resolveAlbumName(name?: string): string {
    const trimmed = name?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : REVIEW_ALBUM;
  }

  /** Draws a deterministic placeholder and encodes it as a JPEG data URL. */
  private render(id: string, targetWidth: number): string {
    const drawIndex = this.drawIndexById.get(id);
    if (drawIndex === undefined) {
      throw this.unavailable(`No such asset: ${id}`);
    }
    const width = Math.max(1, Math.round(targetWidth > 0 ? targetWidth : 320));
    const cacheKey = `${id}@${width}`;
    const cached = this.renderCache.get(cacheKey);
    if (cached) return cached;

    const isScreenshot = !(drawIndex % 7 === 3) && drawIndex % 3 === 1;
    const [nativeW, nativeH] = isScreenshot ? SCREENSHOT_SHAPE : SHAPES[drawIndex % SHAPES.length];
    const height = Math.max(1, Math.round((width * nativeH) / nativeW));

    if (typeof document === 'undefined') return FALLBACK_DATA_URL;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return FALLBACK_DATA_URL;

    const rnd = mulberry32(Math.imul(drawIndex + 1, 40503));
    const hue = Math.floor(rnd() * 360);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `hsl(${hue}, 68%, 58%)`);
    gradient.addColorStop(1, `hsl(${(hue + 55) % 360}, 62%, 28%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(
        rnd() * width,
        rnd() * height,
        (0.1 + rnd() * 0.3) * Math.min(width, height),
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = `hsla(${(hue + 180 + i * 20) % 360}, 75%, 62%, 0.22)`;
      ctx.fill();
    }

    // Language-neutral on purpose: the index number only.
    const label = String(drawIndex + 1);
    ctx.font = `bold ${Math.round(Math.min(width, height) * 0.34)}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillText(label, width / 2 + 2, height / 2 + 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fillText(label, width / 2, height / 2);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    this.renderCache.set(cacheKey, dataUrl);
    return dataUrl;
  }
}
