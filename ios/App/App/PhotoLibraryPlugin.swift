import Capacitor
import Foundation
import Photos
import UIKit

// MARK: - TOOLCHAIN NOTE (why this file avoids some obvious Capacitor APIs)
//
// The Capacitor 8.5.2 iOS dependency is consumed as a PREBUILT XCFramework via
// SPM (`capacitor-swift-pm`), and that binary was compiled with Swift 6.2
// (Xcode 26). Its generated `.swiftinterface` wraps a large set of
// declarations in:
//
//     #if compiler(>=5.3) && $NonescapableTypes
//
// `$NonescapableTypes` is a compiler feature flag that Swift 6.0.3 (Xcode 16.2,
// the toolchain this project is built with) does not recognise, so the guard
// evaluates to FALSE and every declaration inside it is silently dropped from
// the module. The casualties include:
//
//     CAPPluginCall.reject(_:_:_:_:)
//     CAPPluginCall.getValue / getString(_:) / getInt(_:) / getBool(_:) /
//       getDouble(_:) / getArray(_:) / getArray(_:_:) generic overload
//     CAPBridgeViewController.bridge
//
// That is a property of the shipped binary, NOT of this project's Xcode
// configuration — a three-line file compiled with plain `swiftc` against the
// XCFramework reproduces it exactly.
//
// So this file deliberately uses only UNGUARDED public API:
//   * options are read from `call.dictionaryRepresentation` (@objc, unguarded)
//   * rejection goes through `call.unavailable(_:)` (@objc, unguarded)
// Both behave identically on Xcode 26, so this code is forward-compatible;
// once the project moves to Xcode 26 these helpers can be swapped back for the
// idiomatic accessors with no behavioural change.

/// Outcome of claiming the single allowed completion of an image request.
private enum ImageClaim {
    /// Another callback (or the watchdog) already completed the call.
    case alreadyCompleted
    /// This caller owns the completion and should deliver `image`.
    case deliver(UIImage)
    /// This caller owns the completion but there is no image to deliver.
    case nothingToDeliver
}

/// `PHImageManager.requestImage` calls its handler twice for most assets: once
/// with a fast degraded placeholder and again with the full-quality result. It
/// can also deliver *only* the degraded pass (iCloud asset with network access
/// disabled), or nothing at all. This box guarantees the Capacitor call is
/// completed exactly once, and never left hanging.
private final class ImageDelivery {
    private let lock = NSLock()
    private var completed = false
    private var degraded: UIImage?
    private var watchdog: DispatchWorkItem?

    /// Keeps the low-res pass around as a fallback for a stalled cloud fetch.
    func rememberDegraded(_ image: UIImage?) {
        lock.lock()
        defer { lock.unlock() }
        if degraded == nil { degraded = image }
    }

    /// Takes ownership of the one-and-only completion, if still available.
    /// `preferred` wins; otherwise the remembered degraded image is used.
    func claim(preferring preferred: UIImage?) -> ImageClaim {
        lock.lock()
        defer { lock.unlock() }
        if completed { return .alreadyCompleted }
        completed = true
        watchdog?.cancel()
        watchdog = nil
        if let image = preferred ?? degraded { return .deliver(image) }
        return .nothingToDeliver
    }

    /// Arms the timeout. No-op if the call already finished.
    func arm(_ item: DispatchWorkItem) {
        lock.lock()
        defer { lock.unlock() }
        if completed {
            item.cancel()
            return
        }
        watchdog?.cancel()
        watchdog = item
    }
}

/// Bridges the iOS photo library (PhotoKit) to the web layer.
///
/// Safety model: a swipe never destroys anything. Swiping "trash" calls
/// `addToAlbum`, which collects the asset into a real user album (default
/// "Chờ xoá"). Only `deletePhotos` — reachable solely from the explicit
/// confirmation step in the review screen — removes anything, and even then
/// iOS shows its own system confirmation dialog.
@objc(PhotoLibraryPlugin)
public class PhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoLibraryPlugin"
    public let jsName = "PhotoLibrary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listPhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getThumbnail", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getFullImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addToAlbum", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeFromAlbum", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAlbumAssets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deletePhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setFavorite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buildSizeIndex", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSizeIndexStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

    /// Must match `REVIEW_ALBUM` in src/photos/types.ts.
    private static let defaultAlbumName = "Chờ xoá"
    private static let jpegQuality: CGFloat = 0.7
    /// Thumbnails are local-only, so they should come back almost instantly.
    private static let thumbnailTimeout: TimeInterval = 5
    /// Full images may have to stream down from iCloud.
    private static let fullImageTimeout: TimeInterval = 45

    /// All PhotoKit work happens here; the main thread only handles UI + resolves.
    private let workQueue = DispatchQueue(label: "com.tungnt.photoswipe.photolibrary", qos: .userInitiated)

    /// Byte sizes for the whole library. Needed for size filters and size sort.
    private let sizeIndex = PhotoSizeIndex()

    @objc override public func load() {
        // Warms the on-disk size index without blocking startup. Re-attempted
        // later if photo access has not been granted yet.
        sizeIndex.prepare()
    }

    // MARK: - Permissions

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        DispatchQueue.main.async {
            call.resolve(["status": Self.statusString(status)])
        }
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            DispatchQueue.main.async {
                call.resolve(["status": Self.statusString(status)])
            }
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                Self.fail(call, "Could not build the iOS Settings URL.")
                return
            }
            guard UIApplication.shared.canOpenURL(url) else {
                Self.fail(call, "The iOS Settings app cannot be opened from here.")
                return
            }
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened {
                    call.resolve()
                } else {
                    Self.fail(call, "The iOS Settings app refused to open.")
                }
            }
        }
    }

    // MARK: - Listing

    @objc func listPhotos(_ call: CAPPluginCall) {
        let offset = Self.int(call, "offset") ?? 0
        let limit = Self.int(call, "limit") ?? 0
        guard offset >= 0, limit >= 0 else {
            Self.fail(call, "`offset` and `limit` must both be >= 0.")
            return
        }

        let sortBySize = (Self.string(call, "sortBy") ?? "date") == "size"
        // For dates 'newest' is descending; for sizes it means largest-first.
        let descending = (Self.string(call, "sortOrder") ?? "newest") == "newest"
        let minByteSize = Self.int64(call, "minByteSize")
        let maxByteSize = Self.int64(call, "maxByteSize")
        let fetchOptions = Self.fetchOptions(for: call, datesDescending: descending, sortBySize: sortBySize)

        guard hasAccess(call) else { return }

        // Size data lives in a separately-built index, not in PhotoKit.
        let needsSizeIndex = sortBySize || minByteSize != nil || maxByteSize != nil

        workQueue.async {
            self.sizeIndex.prepare()

            guard needsSizeIndex else {
                self.listByFetchOrder(call, options: fetchOptions, offset: offset, limit: limit, pending: false)
                return
            }
            guard self.sizeIndex.isReady else {
                // Best available answer: cheap filters applied, date-sorted.
                // The UI shows progress and retries rather than treating this
                // as the final result.
                self.listByFetchOrder(call, options: fetchOptions, offset: offset, limit: limit, pending: true)
                return
            }
            self.listBySize(
                call,
                options: fetchOptions,
                offset: offset,
                limit: limit,
                sortBySize: sortBySize,
                descending: descending,
                minByteSize: minByteSize,
                maxByteSize: maxByteSize
            )
        }
    }

    /// Cheap path: PhotoKit already applied the predicate and the sort, so the
    /// page is a direct slice of a lazy fetch result — nothing is materialised
    /// beyond the requested window.
    private func listByFetchOrder(
        _ call: CAPPluginCall,
        options: PHFetchOptions,
        offset: Int,
        limit: Int,
        pending: Bool
    ) {
        let fetched = PHAsset.fetchAssets(with: options)
        let total = fetched.count

        var assets: [[String: Any]] = []
        if limit > 0 && offset < total {
            let end = min(offset + limit, total)
            assets.reserveCapacity(end - offset)
            for index in offset..<end {
                assets.append(self.payload(for: fetched.object(at: index)))
            }
        }

        var result: [String: Any] = ["assets": assets, "total": total]
        if pending {
            result["sizeIndexPending"] = true
        }
        call.resolve(result)
    }

    /// Expensive path, only taken once the size index is ready. Collects ids
    /// (not PhotoAssets), joins them against the index, filters and sorts in
    /// memory, and only materialises the payload for the requested page.
    private func listBySize(
        _ call: CAPPluginCall,
        options: PHFetchOptions,
        offset: Int,
        limit: Int,
        sortBySize: Bool,
        descending: Bool,
        minByteSize: Int64?,
        maxByteSize: Int64?
    ) {
        let fetched = PHAsset.fetchAssets(with: options)
        let count = fetched.count

        var ids: [String] = []
        ids.reserveCapacity(count)
        for position in 0..<count {
            ids.append(fetched.object(at: position).localIdentifier)
        }
        let sizes = sizeIndex.sizes(for: ids)

        var rows: [(position: Int, size: Int64)] = []
        rows.reserveCapacity(count)
        for position in 0..<count {
            let size = sizes[position]
            if let minByteSize, size < minByteSize { continue }
            if let maxByteSize, size > maxByteSize { continue }
            rows.append((position, size))
        }

        if sortBySize {
            rows.sort { lhs, rhs in
                if lhs.size != rhs.size {
                    return descending ? lhs.size > rhs.size : lhs.size < rhs.size
                }
                // Stable tie-break on the fetch (date) order.
                return lhs.position < rhs.position
            }
        }

        let total = rows.count
        var assets: [[String: Any]] = []
        if limit > 0 && offset < total {
            let end = min(offset + limit, total)
            assets.reserveCapacity(end - offset)
            for row in rows[offset..<end] {
                assets.append(self.payload(for: fetched.object(at: row.position)))
            }
        }
        call.resolve(["assets": assets, "total": total])
    }

    // MARK: - Size index

    @objc func buildSizeIndex(_ call: CAPPluginCall) {
        guard hasAccess(call) else { return }
        workQueue.async {
            self.sizeIndex.prepare()
            // Idempotent: a no-op while already building or ready. Resolves
            // straight away — the scan continues in the background.
            call.resolve(self.sizeIndex.startBuild().payload)
        }
    }

    @objc func getSizeIndexStatus(_ call: CAPPluginCall) {
        // Deliberately does no PhotoKit work: the UI polls this ~1×/second.
        call.resolve(sizeIndex.status().payload)
    }

    // MARK: - Favorites

    @objc func setFavorite(_ call: CAPPluginCall) {
        guard let identifier = Self.string(call, "id"), !identifier.isEmpty else {
            Self.fail(call, "`id` is required and must be a non-empty localIdentifier.")
            return
        }
        guard let favorite = Self.bool(call, "favorite") else {
            Self.fail(call, "`favorite` is required and must be a boolean.")
            return
        }
        guard hasAccess(call) else { return }

        workQueue.async {
            guard let asset = Self.fetchAsset(identifier) else {
                Self.fail(call, "No asset matches the localIdentifier \(identifier).")
                return
            }
            guard asset.canPerform(.properties) else {
                Self.fail(call, "The asset \(identifier) does not allow its properties to be changed.")
                return
            }
            // No system dialog for this one — it applies immediately.
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest(for: asset).isFavorite = favorite
            } completionHandler: { success, error in
                if success {
                    call.resolve()
                    return
                }
                Self.fail(call, error?.localizedDescription ?? "Could not update the favourite flag for \(identifier).")
            }
        }
    }

    // MARK: - Images

    @objc func getThumbnail(_ call: CAPPluginCall) {
        // Never allow network access: a thumbnail must not stall on an iCloud download.
        deliverImage(call, allowNetwork: false, timeout: Self.thumbnailTimeout)
    }

    @objc func getFullImage(_ call: CAPPluginCall) {
        deliverImage(call, allowNetwork: true, timeout: Self.fullImageTimeout)
    }

    private func deliverImage(_ call: CAPPluginCall, allowNetwork: Bool, timeout: TimeInterval) {
        guard let identifier = Self.string(call, "id"), !identifier.isEmpty else {
            Self.fail(call, "`id` is required and must be a non-empty localIdentifier.")
            return
        }
        let requestedWidth = Self.number(call, "targetWidth")?.doubleValue ?? 0
        guard requestedWidth > 0 else {
            Self.fail(call, "`targetWidth` must be greater than 0.")
            return
        }
        guard hasAccess(call) else { return }
        let width = CGFloat(requestedWidth)

        workQueue.async {
            guard let asset = Self.fetchAsset(identifier) else {
                Self.fail(call, "No asset matches the localIdentifier \(identifier).")
                return
            }

            let pixelWidth = CGFloat(asset.pixelWidth)
            let pixelHeight = CGFloat(asset.pixelHeight)
            let aspect = (pixelWidth > 0 && pixelHeight > 0) ? pixelHeight / pixelWidth : 1
            let targetSize = CGSize(width: width, height: max(1, (width * aspect).rounded()))

            let options = PHImageRequestOptions()
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .exact
            options.isSynchronous = false
            options.isNetworkAccessAllowed = allowNetwork
            options.version = .current

            let delivery = ImageDelivery()

            // Encoding is expensive; PhotoKit calls the handler on the main
            // queue, so always hop off it before touching JPEG data.
            let complete: (UIImage) -> Void = { image in
                self.workQueue.async {
                    guard let dataUrl = Self.encodeJPEG(image, targetWidth: width) else {
                        Self.fail(call, "Could not JPEG-encode the image for \(identifier).")
                        return
                    }
                    call.resolve(["dataUrl": dataUrl])
                }
            }

            PHImageManager.default().requestImage(
                for: asset,
                targetSize: targetSize,
                contentMode: .aspectFit,
                options: options
            ) { image, info in
                let isDegraded = (info?[PHImageResultIsDegradedKey] as? NSNumber)?.boolValue ?? false
                let isCancelled = (info?[PHImageCancelledKey] as? NSNumber)?.boolValue ?? false
                let failure = info?[PHImageErrorKey] as? NSError

                if isDegraded && !isCancelled && failure == nil {
                    // Placeholder pass — hold it back and wait for the real one.
                    delivery.rememberDegraded(image)
                    return
                }

                switch delivery.claim(preferring: image) {
                case .alreadyCompleted:
                    return
                case .deliver(let finalImage):
                    complete(finalImage)
                case .nothingToDeliver:
                    if isCancelled {
                        Self.fail(call, "The image request for \(identifier) was cancelled.")
                    } else if let failure {
                        Self.fail(call, failure.localizedDescription)
                    } else if !allowNetwork {
                        Self.fail(call, "\(identifier) is stored in iCloud and has no local thumbnail.")
                    } else {
                        Self.fail(call, "PhotoKit returned no image data for \(identifier).")
                    }
                }
            }

            // Belt and braces: if PhotoKit never sends the final callback, fall
            // back to the degraded pass rather than leaving the promise pending.
            let watchdog = DispatchWorkItem {
                switch delivery.claim(preferring: nil) {
                case .alreadyCompleted:
                    return
                case .deliver(let fallback):
                    complete(fallback)
                case .nothingToDeliver:
                    Self.fail(call, "Timed out loading the image for \(identifier).")
                }
            }
            delivery.arm(watchdog)
            DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + timeout, execute: watchdog)
        }
    }

    // MARK: - Review album

    @objc func addToAlbum(_ call: CAPPluginCall) {
        guard let ids = Self.stringArray(call, "ids"), !ids.isEmpty else {
            Self.fail(call, "`ids` must be a non-empty array of localIdentifiers.")
            return
        }
        let albumName = Self.albumName(from: call)
        guard hasAccess(call) else { return }

        workQueue.async {
            // Reuse the first existing album with this title. iOS happily allows
            // duplicate titles, so never create one blindly.
            if let album = Self.findAlbum(named: albumName) {
                self.add(ids: ids, to: album, albumName: albumName, call: call)
                return
            }
            Self.createAlbum(named: albumName) { album, error in
                guard let album else {
                    Self.fail(call, error?.localizedDescription ?? "Could not create the album \"\(albumName)\".")
                    return
                }
                self.add(ids: ids, to: album, albumName: albumName, call: call)
            }
        }
    }

    private func add(ids: [String], to album: PHAssetCollection, albumName: String, call: CAPPluginCall) {
        // Under `.limited` access, ids outside the user's selection simply do
        // not come back. That is not an error — we add whatever we can see.
        var candidates: [PHAsset] = []
        PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil).enumerateObjects { asset, _, _ in
            candidates.append(asset)
        }

        let existing = PHAsset.fetchAssets(in: album, options: nil)
        var existingIds = Set<String>()
        existing.enumerateObjects { asset, _, _ in existingIds.insert(asset.localIdentifier) }
        let existingCount = existing.count

        // Diff first so repeated swipes never duplicate rows in the album.
        let additions = candidates.filter { !existingIds.contains($0.localIdentifier) }
        guard !additions.isEmpty else {
            call.resolve(["addedIds": [], "albumName": albumName, "albumCount": existingCount])
            return
        }

        PHPhotoLibrary.shared().performChanges {
            PHAssetCollectionChangeRequest(for: album)?.addAssets(additions as NSArray)
        } completionHandler: { success, error in
            guard success else {
                if let error = error as NSError?, Self.isUserCancelled(error) {
                    call.resolve(["addedIds": [], "albumName": albumName, "albumCount": existingCount])
                    return
                }
                Self.fail(call, error?.localizedDescription ?? "Could not add the photos to \"\(albumName)\".")
                return
            }
            call.resolve([
                "addedIds": additions.map { $0.localIdentifier },
                "albumName": albumName,
                "albumCount": Self.assetCount(of: album)
            ])
        }
    }

    @objc func removeFromAlbum(_ call: CAPPluginCall) {
        guard let ids = Self.stringArray(call, "ids"), !ids.isEmpty else {
            Self.fail(call, "`ids` must be a non-empty array of localIdentifiers.")
            return
        }
        let albumName = Self.albumName(from: call)
        guard hasAccess(call) else { return }

        workQueue.async {
            // Nothing to undo if the album was never created.
            guard let album = Self.findAlbum(named: albumName) else {
                call.resolve(["removedIds": [], "albumCount": 0])
                return
            }

            let wanted = Set(ids)
            let existing = PHAsset.fetchAssets(in: album, options: nil)
            let existingCount = existing.count
            var removals: [PHAsset] = []
            existing.enumerateObjects { asset, _, _ in
                if wanted.contains(asset.localIdentifier) { removals.append(asset) }
            }

            guard !removals.isEmpty else {
                call.resolve(["removedIds": [], "albumCount": existingCount])
                return
            }

            PHPhotoLibrary.shared().performChanges {
                // Removes album membership only — the photos stay in the library.
                PHAssetCollectionChangeRequest(for: album)?.removeAssets(removals as NSArray)
            } completionHandler: { success, error in
                guard success else {
                    if let error = error as NSError?, Self.isUserCancelled(error) {
                        call.resolve(["removedIds": [], "albumCount": existingCount])
                        return
                    }
                    Self.fail(call, error?.localizedDescription ?? "Could not remove the photos from \"\(albumName)\".")
                    return
                }
                call.resolve([
                    "removedIds": removals.map { $0.localIdentifier },
                    "albumCount": Self.assetCount(of: album)
                ])
            }
        }
    }

    @objc func getAlbumAssets(_ call: CAPPluginCall) {
        let albumName = Self.albumName(from: call)
        guard hasAccess(call) else { return }

        workQueue.async {
            guard let album = Self.findAlbum(named: albumName) else {
                call.resolve(["assets": [], "exists": false])
                return
            }
            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            let fetched = PHAsset.fetchAssets(in: album, options: options)
            var assets: [[String: Any]] = []
            assets.reserveCapacity(fetched.count)
            fetched.enumerateObjects { asset, _, _ in assets.append(self.payload(for: asset)) }
            call.resolve(["assets": assets, "exists": true])
        }
    }

    // MARK: - Deletion

    @objc func deletePhotos(_ call: CAPPluginCall) {
        guard let ids = Self.stringArray(call, "ids"), !ids.isEmpty else {
            Self.fail(call, "`ids` must be a non-empty array of localIdentifiers.")
            return
        }
        guard hasAccess(call) else { return }

        workQueue.async {
            var assets: [PHAsset] = []
            PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil).enumerateObjects { asset, _, _ in
                assets.append(asset)
            }
            guard !assets.isEmpty else {
                Self.fail(call, "None of the supplied ids match an asset in the photo library.")
                return
            }
            let deletedIds = assets.map { $0.localIdentifier }

            // iOS puts up its own confirmation sheet for this batch.
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.deleteAssets(assets as NSArray)
            } completionHandler: { success, error in
                if success {
                    // Keep the size index honest instead of letting it go stale.
                    self.sizeIndex.forget(deletedIds)
                    call.resolve(["confirmed": true, "deletedIds": deletedIds])
                    return
                }
                if let error = error as NSError?, Self.isUserCancelled(error) {
                    // The user tapped Cancel. Not an error — just nothing happened.
                    call.resolve(["confirmed": false, "deletedIds": []])
                    return
                }
                Self.fail(call, error?.localizedDescription ?? "The deletion failed.")
            }
        }
    }

    // MARK: - Helpers

    private static func statusString(_ status: PHAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "granted"
        case .limited: return "limited"
        case .denied, .restricted: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "notDetermined"
        }
    }

    /// Rejects and returns false when the library is not readable at all.
    /// `.limited` counts as access — PhotoKit just shows a smaller world.
    private func hasAccess(_ call: CAPPluginCall) -> Bool {
        switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
        case .authorized, .limited:
            return true
        case .notDetermined:
            Self.fail(call, "Photo library access has not been requested yet.")
            return false
        default:
            Self.fail(call, "Photo library access is denied. Enable it in iOS Settings.")
            return false
        }
    }

    private static func albumName(from call: CAPPluginCall) -> String {
        let requested = Self.string(call, "albumName")?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let requested, !requested.isEmpty { return requested }
        return defaultAlbumName
    }

    // MARK: Option accessors
    //
    // These replace `call.getString(_:)` / `getInt(_:)` / `getArray(_:_:)` etc.
    // See the TOOLCHAIN NOTE at the top of this file. `dictionaryRepresentation`
    // is the very same backing JSObject those accessors read, so the semantics
    // are unchanged — absent keys and wrong-typed values both yield nil.

    private static func string(_ call: CAPPluginCall, _ key: String) -> String? {
        return call.dictionaryRepresentation[key] as? String
    }

    /// JS numbers all arrive as `NSNumber`, so read that and convert explicitly
    /// rather than relying on a bridged `as? Int`, which fails for e.g. `1.5`.
    private static func number(_ call: CAPPluginCall, _ key: String) -> NSNumber? {
        return call.dictionaryRepresentation[key] as? NSNumber
    }

    private static func int(_ call: CAPPluginCall, _ key: String) -> Int? {
        return number(call, key)?.intValue
    }

    private static func int64(_ call: CAPPluginCall, _ key: String) -> Int64? {
        return number(call, key)?.int64Value
    }

    private static func bool(_ call: CAPPluginCall, _ key: String) -> Bool? {
        return number(call, key)?.boolValue
    }

    /// Returns nil unless the value is an array whose every element is a String.
    private static func stringArray(_ call: CAPPluginCall, _ key: String) -> [String]? {
        guard let raw = call.dictionaryRepresentation[key] as? [Any] else { return nil }
        let strings = raw.compactMap { $0 as? String }
        return strings.count == raw.count ? strings : nil
    }

    /// Rejects the JS promise with `message`.
    ///
    /// `call.reject(_:_:_:_:)` is the natural API but is hidden by the binary
    /// framework (see the TOOLCHAIN NOTE). `unavailable(_:)` is the unguarded
    /// equivalent: it rejects the promise carrying our message, under the error
    /// code "UNAVAILABLE".
    private static func fail(_ call: CAPPluginCall, _ message: String) {
        call.unavailable(message)
    }

    private static func mediaTypePredicate(_ mediaType: String) -> NSPredicate? {
        switch mediaType {
        case "image":
            return NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
        case "video":
            return NSPredicate(format: "mediaType == %d", PHAssetMediaType.video.rawValue)
        default:
            return nil
        }
    }

    /// Compiles every *cheap* filter into the fetch so PhotoKit evaluates it.
    /// Size filters are deliberately absent — they need the size index.
    private static func fetchOptions(
        for call: CAPPluginCall,
        datesDescending: Bool,
        sortBySize: Bool
    ) -> PHFetchOptions {
        let options = PHFetchOptions()
        // When sorting by size the date order is only the tie-break, so it is
        // always descending there; otherwise it is the requested order.
        let ascending = sortBySize ? false : !datesDescending
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: ascending)]

        var predicates: [NSPredicate] = []
        if let mediaType = mediaTypePredicate(Self.string(call, "mediaType") ?? "all") {
            predicates.append(mediaType)
        }
        if let from = int64(call, "dateFrom") {
            let date = Date(timeIntervalSince1970: Double(from) / 1000.0)
            predicates.append(NSPredicate(format: "creationDate >= %@", date as NSDate))
        }
        if let to = int64(call, "dateTo") {
            let date = Date(timeIntervalSince1970: Double(to) / 1000.0)
            predicates.append(NSPredicate(format: "creationDate <= %@", date as NSDate))
        }
        if Self.bool(call, "screenshotsOnly") == true {
            // `mediaSubtypes` is a bitmask. The rawValue is a UInt, and feeding
            // a UInt straight to %d silently matches nothing — convert to Int.
            let mask = Int(PHAssetMediaSubtype.photoScreenshot.rawValue)
            predicates.append(NSPredicate(format: "(mediaSubtypes & %d) != 0", mask))
        }

        if predicates.count == 1 {
            options.predicate = predicates[0]
        } else if predicates.count > 1 {
            options.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        }
        return options
    }

    private static func fetchAsset(_ identifier: String) -> PHAsset? {
        return PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil).firstObject
    }

    private static func findAlbum(named name: String) -> PHAssetCollection? {
        let options = PHFetchOptions()
        options.predicate = NSPredicate(format: "localizedTitle = %@", name)
        let matches = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .albumRegular, options: options)
        if let first = matches.firstObject { return first }

        // Fallback scan: the localizedTitle predicate is not honoured for every
        // album flavour, and users rarely have more than a handful of albums.
        var found: PHAssetCollection?
        PHAssetCollection.fetchAssetCollections(with: .album, subtype: .albumRegular, options: nil)
            .enumerateObjects { collection, _, stop in
                if collection.localizedTitle == name {
                    found = collection
                    stop.pointee = true
                }
            }
        return found
    }

    private static func createAlbum(named name: String, completion: @escaping (PHAssetCollection?, Error?) -> Void) {
        var placeholder: PHObjectPlaceholder?
        PHPhotoLibrary.shared().performChanges {
            let request = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: name)
            // The real collection cannot be read inside the block — only the
            // placeholder's identifier, which becomes resolvable afterwards.
            placeholder = request.placeholderForCreatedAssetCollection
        } completionHandler: { success, error in
            guard success, let identifier = placeholder?.localIdentifier else {
                completion(nil, error)
                return
            }
            let created = PHAssetCollection
                .fetchAssetCollections(withLocalIdentifiers: [identifier], options: nil)
                .firstObject
            completion(created, created == nil ? error : nil)
        }
    }

    /// Re-fetches the collection so the count reflects the change we just made.
    private static func assetCount(of album: PHAssetCollection) -> Int {
        let refreshed = PHAssetCollection
            .fetchAssetCollections(withLocalIdentifiers: [album.localIdentifier], options: nil)
            .firstObject ?? album
        return PHAsset.fetchAssets(in: refreshed, options: nil).count
    }

    /// `PHPhotosError.userCancelled` and `NSUserCancelledError` are both 3072.
    private static func isUserCancelled(_ error: NSError) -> Bool {
        return error.code == 3072
    }

    private func payload(for asset: PHAsset) -> [String: Any] {
        var byteSize: Int64 = 0
        var locallyAvailable: Bool?

        // `fileSize` / `locallyAvailable` are undocumented KVC keys on
        // PHAssetResource, so probe with `responds(to:)` — a plain
        // `value(forKey:)` on a missing key raises an uncatchable ObjC exception.
        for resource in PHAssetResource.assetResources(for: asset) {
            if resource.responds(to: NSSelectorFromString("fileSize")),
               let size = resource.value(forKey: "fileSize") as? NSNumber {
                byteSize = max(byteSize, size.int64Value)
            }
            if resource.responds(to: NSSelectorFromString("locallyAvailable")),
               let available = resource.value(forKey: "locallyAvailable") as? NSNumber {
                locallyAvailable = (locallyAvailable ?? false) || available.boolValue
            }
        }

        return [
            "id": asset.localIdentifier,
            "width": asset.pixelWidth,
            "height": asset.pixelHeight,
            "creationDate": (asset.creationDate?.timeIntervalSince1970 ?? 0) * 1000,
            "byteSize": byteSize,
            "mediaType": asset.mediaType == .video ? "video" : "image",
            "duration": asset.duration,
            // No local resource => it still has to come down from iCloud.
            // Approximation only; we never hit the network to find out.
            "isCloudOnly": locallyAvailable.map { !$0 } ?? false,
            "isScreenshot": asset.mediaSubtypes.contains(.photoScreenshot),
            "isFavorite": asset.isFavorite
        ]
    }

    private static func encodeJPEG(_ image: UIImage, targetWidth: CGFloat) -> String? {
        guard let data = resize(image, toWidth: targetWidth).jpegData(compressionQuality: jpegQuality) else {
            return nil
        }
        return "data:image/jpeg;base64," + data.base64EncodedString()
    }

    private static func resize(_ image: UIImage, toWidth width: CGFloat) -> UIImage {
        let currentWidth = image.size.width * image.scale
        let currentHeight = image.size.height * image.scale
        guard width > 0, currentWidth > 0, currentHeight > 0 else { return image }
        // Never upscale — a degraded cloud placeholder stays small and cheap.
        guard currentWidth > width + 1 else { return image }

        let size = CGSize(
            width: width.rounded(),
            height: max(1, (width * currentHeight / currentWidth).rounded())
        )
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
