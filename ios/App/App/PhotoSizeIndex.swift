import Foundation
import Photos

/// Byte sizes for the whole photo library, measured once in the background.
///
/// Why this exists: `PHAsset` exposes no file size to `NSPredicate`, so size
/// filtering and size sorting cannot be pushed into a PhotoKit fetch. The only
/// way to get a byte size is `PHAssetResource.assetResources(for:)` per asset,
/// which is far too slow to do inline for a 50k-photo library. So we measure
/// everything once on a background queue, cache it on disk, and reconcile on
/// launch.
///
/// THREAD SAFETY: every mutation happens on the serial `scanQueue`; every read
/// of shared state goes through `lock`. `listPhotos` reads from the plugin's
/// work queue while a scan writes from the scan queue, so nothing here may
/// touch `table`, `state`, `indexed`, `total` or `libraryCount` unguarded.
final class PhotoSizeIndex {
    enum State: String {
        case absent
        case building
        case ready
    }

    struct Status {
        let state: State
        let indexed: Int
        let total: Int

        var payload: [String: Any] {
            return ["state": state.rawValue, "indexed": indexed, "total": total]
        }
    }

    private static let formatVersion = 1
    /// How often the scan publishes progress. Keeps lock traffic sane.
    private static let progressStride = 100

    private let lock = NSLock()
    /// Serial: the one and only place shared state is mutated.
    private let scanQueue = DispatchQueue(label: "com.tungnt.photoswipe.sizeindex", qos: .utility)

    // MARK: State guarded by `lock`
    private var table: [String: Int64] = [:]
    private var state: State = .absent
    private var indexed = 0
    private var total = 0
    /// Library asset count at the time the index was last completed. Used to
    /// detect a stale on-disk index without re-measuring anything.
    private var libraryCount = -1

    /// Only ever touched on `scanQueue`.
    private var loadAttempted = false

    // MARK: - Reads

    func status() -> Status {
        lock.lock()
        defer { lock.unlock() }
        return Status(state: state, indexed: indexed, total: total)
    }

    var isReady: Bool {
        lock.lock()
        defer { lock.unlock() }
        return state == .ready
    }

    /// Batch lookup: one lock acquisition for a whole page/fetch.
    /// Unknown ids report 0, matching the `byteSize` contract.
    func sizes(for ids: [String]) -> [Int64] {
        lock.lock()
        defer { lock.unlock() }
        return ids.map { table[$0] ?? 0 }
    }

    // MARK: - Lifecycle

    /// Reads the cached index from disk. Cheap no-op once it has run, and
    /// retried automatically while photo access has not been granted yet.
    func prepare() {
        scanQueue.async { self.loadFromDiskIfNeeded() }
    }

    /// Idempotent. Returns the status to report to the caller immediately —
    /// the scan itself keeps running in the background.
    func startBuild() -> Status {
        lock.lock()
        let current = state
        lock.unlock()
        if current != .absent {
            return status()
        }

        // Cheap: fetch results are lazy, `count` does not materialise assets.
        let count = PHAsset.fetchAssets(with: PHFetchOptions()).count

        lock.lock()
        guard state == .absent else {
            let snapshot = Status(state: state, indexed: indexed, total: total)
            lock.unlock()
            return snapshot
        }
        state = .building
        indexed = 0
        total = count
        let snapshot = Status(state: state, indexed: indexed, total: total)
        lock.unlock()

        scanQueue.async { self.performScan() }
        return snapshot
    }

    /// Drops deleted assets so the index does not report phantom sizes.
    func forget(_ ids: [String]) {
        lock.lock()
        var removed = 0
        for id in ids where table.removeValue(forKey: id) != nil {
            removed += 1
        }
        guard removed > 0 else {
            lock.unlock()
            return
        }
        if state == .ready {
            indexed = table.count
            total = table.count
        }
        if libraryCount > 0 {
            libraryCount = max(0, libraryCount - removed)
        }
        let snapshot = table
        let count = libraryCount
        let persist = state == .ready
        lock.unlock()

        if persist {
            scanQueue.async { Self.write(sizes: snapshot, libraryCount: count) }
        }
    }

    // MARK: - Scanning (scanQueue only)

    private func performScan() {
        // Warm start: reuse whatever the cached index already knows.
        loadFromDiskIfNeeded()

        lock.lock()
        let known = table
        lock.unlock()

        let fetched = PHAsset.fetchAssets(with: PHFetchOptions())
        let count = fetched.count

        lock.lock()
        total = count
        lock.unlock()

        var measured: [String: Int64] = [:]
        measured.reserveCapacity(count)

        for position in 0..<count {
            let asset = fetched.object(at: position)
            let id = asset.localIdentifier
            // Reconcile: already-measured assets are not re-measured.
            // Metadata only — never request image data here.
            measured[id] = known[id] ?? Self.measure(asset)

            if (position + 1) % Self.progressStride == 0 {
                lock.lock()
                indexed = position + 1
                lock.unlock()
            }
        }

        // Anything in `known` but not in `measured` is an asset that has since
        // been deleted, and is dropped simply by not being carried over.
        lock.lock()
        table = measured
        indexed = measured.count
        total = measured.count
        libraryCount = count
        state = .ready
        let snapshot = measured
        lock.unlock()

        Self.write(sizes: snapshot, libraryCount: count)
    }

    /// `fileSize` is an undocumented but KVC-accessible property of
    /// PHAssetResource. Probe with `responds(to:)` first — `value(forKey:)` on
    /// an unknown key raises an ObjC exception Swift cannot catch.
    private static func measure(_ asset: PHAsset) -> Int64 {
        var largest: Int64 = 0
        for resource in PHAssetResource.assetResources(for: asset) {
            if resource.responds(to: NSSelectorFromString("fileSize")),
               let size = resource.value(forKey: "fileSize") as? NSNumber {
                largest = max(largest, size.int64Value)
            }
        }
        return largest
    }

    // MARK: - Persistence (scanQueue only)

    private func loadFromDiskIfNeeded() {
        guard !loadAttempted else { return }
        // Without photo access the library count reads as 0 and would make a
        // perfectly good index look stale. Retry after permission is granted.
        switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
        case .authorized, .limited:
            break
        default:
            return
        }
        loadAttempted = true

        guard let stored = Self.read() else { return }
        let currentCount = PHAsset.fetchAssets(with: PHFetchOptions()).count

        lock.lock()
        defer { lock.unlock() }
        // Even a stale index is a useful warm start for the next scan.
        if table.isEmpty {
            table = stored.sizes
        }
        if libraryCount < 0 {
            libraryCount = stored.libraryCount
        }
        // Fresh only if the library has not changed size since we wrote it.
        // `state` is `.building` when called from performScan — never promote.
        if state == .absent, !stored.sizes.isEmpty, stored.libraryCount == currentCount {
            state = .ready
            indexed = stored.sizes.count
            total = stored.sizes.count
        }
    }

    private static func fileURL() -> URL? {
        let manager = FileManager.default
        guard let base = manager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let directory = base.appendingPathComponent("PhotoSwipe", isDirectory: true)
        if !manager.fileExists(atPath: directory.path) {
            try? manager.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        return directory.appendingPathComponent("size-index.json")
    }

    private static func read() -> (sizes: [String: Int64], libraryCount: Int)? {
        guard let url = fileURL(),
              let data = try? Data(contentsOf: url),
              let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              (root["version"] as? NSNumber)?.intValue == formatVersion,
              let raw = root["sizes"] as? [String: NSNumber] else {
            return nil
        }
        var sizes: [String: Int64] = [:]
        sizes.reserveCapacity(raw.count)
        for (id, value) in raw {
            sizes[id] = value.int64Value
        }
        let libraryCount = (root["libraryCount"] as? NSNumber)?.intValue ?? -1
        return (sizes, libraryCount)
    }

    private static func write(sizes: [String: Int64], libraryCount: Int) {
        guard let url = fileURL() else { return }
        var encoded: [String: NSNumber] = [:]
        encoded.reserveCapacity(sizes.count)
        for (id, size) in sizes {
            encoded[id] = NSNumber(value: size)
        }
        let root: [String: Any] = [
            "version": NSNumber(value: formatVersion),
            "libraryCount": NSNumber(value: libraryCount),
            "sizes": encoded
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: root) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
