import type { Language } from '../photos/types'

/**
 * Vietnamese is the reference table: its keys define `StringKey`, so every
 * other language table is typed as `Record<StringKey, string>` and a missing
 * (or misspelled) key is a compile error rather than a silent fallback.
 *
 * Keys ending in `_one` / `_other` are plural variants resolved by
 * `I18n.tn(base, count)`. Vietnamese has no plural marking, so both variants
 * are simply identical there.
 */
const vi = {
  'app.title': 'Dọn ảnh',

  'common.left': 'trái',
  'common.right': 'phải',
  'common.cancel': 'Huỷ',
  'common.close': 'Đóng',
  'common.retry': 'Thử lại',
  'common.on': 'Bật',
  'common.off': 'Tắt',
  'common.nPhotos_one': '{count} ảnh',
  'common.nPhotos_other': '{count} ảnh',

  'perm.checking': 'Đang kiểm tra quyền truy cập…',
  'perm.denied.title': 'Cần quyền truy cập ảnh',
  'perm.denied.body':
    'Ứng dụng cần quyền vào thư viện ảnh để hiển thị và dọn dẹp ảnh của bạn. Không có ảnh nào rời khỏi thiết bị.',
  'perm.denied.settings': 'Mở Cài đặt',
  'perm.denied.recheck': 'Kiểm tra lại',
  'perm.limited.banner': 'Chỉ truy cập được {count} ảnh đã chọn',
  'perm.limited.action': 'Chọn thêm',

  'header.settings': 'Cài đặt',
  'header.filters': 'Bộ lọc',
  'header.progress': '{done} / {total}',
  'header.screenshots': 'Ảnh màn hình',

  'deck.loading': 'Đang tải ảnh…',
  'deck.empty.title': 'Không có ảnh nào',
  'deck.empty.body':
    'Thư viện trống hoặc không có ảnh nào khớp với bộ lọc hiện tại.',
  'deck.empty.clear': 'Xoá bộ lọc',
  'deck.done.title': 'Đã xem hết!',
  'deck.done.body_one': 'Bạn đã xem qua {count} ảnh.',
  'deck.done.body_other': 'Bạn đã xem qua {count} ảnh.',
  'deck.done.restart': 'Xem lại từ đầu',

  'card.badge.keep': 'GIỮ',
  'card.badge.trash': 'CHỜ XOÁ',
  'card.badge.favorite': 'YÊU THÍCH',
  'card.badge.later': 'ĐỂ SAU',
  'card.inAlbum': 'Đã ở trong album',
  'card.cloud': 'iCloud',
  'card.screenshot': 'Ảnh màn hình',
  'card.favorite': 'Yêu thích',
  'card.open': 'Chạm để xem lớn',

  'footer.keep': 'Giữ',
  'footer.trash': 'Chờ xoá',
  'footer.favorite': 'Yêu thích',
  'footer.later': 'Để sau',
  'footer.undo': 'Hoàn tác',
  'footer.review_one': 'Xem lại {count} ảnh',
  'footer.review_other': 'Xem lại {count} ảnh',
  'footer.reclaim': 'Giải phóng ~{size}',
  'footer.syncing': 'Đang lưu vào album…',

  'review.title': 'Album chờ xoá',
  'review.subtitle': '{count} · {size}',
  'review.loading': 'Đang tải album…',
  'review.error': 'Không đọc được album « {album} ».',
  'review.hint': 'Chạm vào một ảnh để bỏ nó khỏi album.',
  'review.empty.title': 'Chưa có ảnh nào chờ xoá',
  'review.empty.body':
    'Vuốt {trashSide} ở màn hình chính để thu thập ảnh vào album « {album} ».',
  'review.openPhotos': 'Mở trong app Ảnh',
  'review.openPhotos.note':
    'Album « {album} » đã sẵn sàng trong app Ảnh. Mở app Ảnh → Album → « {album} » để xem lại và xoá theo nhịp của bạn.',
  'review.delete_one': 'Xoá vĩnh viễn {count} ảnh',
  'review.delete_other': 'Xoá vĩnh viễn {count} ảnh',
  'review.deleting': 'Đang xoá…',

  'confirm.title_one': 'Xoá vĩnh viễn {count} ảnh?',
  'confirm.title_other': 'Xoá vĩnh viễn {count} ảnh?',
  'confirm.body':
    'Hành động này không thể hoàn tác. iOS sẽ hỏi xác nhận một lần nữa.',
  'confirm.freed': 'Giải phóng khoảng {size}.',
  'confirm.ok': 'Xoá vĩnh viễn',

  'toast.deleted_one': 'Đã xoá {count} ảnh · giải phóng {size}',
  'toast.deleted_other': 'Đã xoá {count} ảnh · giải phóng {size}',
  'toast.deleteCancelled': 'Đã huỷ. Ảnh vẫn nằm trong album « {album} ».',
  'toast.deleteFailed': 'Không xoá được ảnh. Hãy thử lại.',
  'toast.albumError': 'Không cập nhật được album « {album} ».',
  'toast.unmarked': 'Đã bỏ khỏi album',
  'toast.nothingToUndo': 'Không có gì để hoàn tác',
  'toast.favorited': 'Đã thêm vào Yêu thích',
  'toast.later': 'Sẽ xem lại ở cuối',
  'toast.favoriteFailed': 'Không cập nhật được Yêu thích',

  'sizeIndex.title': 'Đang quét dung lượng…',
  'sizeIndex.progress': '{indexed} / {total}',
  'sizeIndex.body':
    'Lọc hoặc sắp xếp theo dung lượng cần quét thư viện một lần. Bạn có thể huỷ để quay lại bộ lọc trước.',
  'sizeIndex.cancel': 'Huỷ và quay lại',
  'sizeIndex.waiting': 'Đang chuẩn bị quét…',

  'filters.title': 'Bộ lọc & sắp xếp',
  'filters.done': 'Xong',
  'filters.clear': 'Xoá bộ lọc',
  'filters.active_one': '{count} bộ lọc đang bật',
  'filters.active_other': '{count} bộ lọc đang bật',
  'filters.summary.none': 'Không có bộ lọc',
  'filters.media': 'Loại nội dung',
  'filters.media.all': 'Tất cả',
  'filters.media.image': 'Chỉ ảnh',
  'filters.media.video': 'Chỉ video',
  'filters.screenshotsOnly': 'Chỉ ảnh chụp màn hình',
  'filters.screenshotsOnly.hint':
    'Cách dọn dẹp nhanh nhất — ảnh màn hình thường chiếm nhiều chỗ mà ít khi cần.',
  'filters.date': 'Khoảng thời gian',
  'filters.date.all': 'Tất cả',
  'filters.date.thisYear': 'Năm nay',
  'filters.date.older1y': 'Hơn 1 năm trước',
  'filters.date.custom': 'Tuỳ chọn',
  'filters.date.from': 'Từ ngày',
  'filters.date.to': 'Đến ngày',
  'filters.size': 'Dung lượng',
  'filters.size.all': 'Tất cả',
  'filters.size.over': 'Lớn hơn {size}',
  'filters.size.custom': 'Tuỳ chọn',
  'filters.size.min': 'Tối thiểu (MB)',
  'filters.size.max': 'Tối đa (MB)',
  'filters.size.needsIndex':
    'Cần quét dung lượng thư viện một lần trước khi lọc.',
  'filters.sort': 'Sắp xếp',
  'filters.sort.date': 'Theo ngày',
  'filters.sort.size': 'Theo dung lượng',
  'filters.order.newest': 'Mới nhất trước',
  'filters.order.oldest': 'Cũ nhất trước',
  'filters.order.largest': 'Lớn nhất trước',
  'filters.order.smallest': 'Nhỏ nhất trước',

  'settings.title': 'Cài đặt',
  'settings.done': 'Xong',
  'settings.language': 'Ngôn ngữ / Language',
  'settings.language.vi': 'Tiếng Việt',
  'settings.language.en': 'English',
  'settings.direction': 'Hướng vuốt',
  'settings.direction.left': 'Vuốt trái = chờ xoá',
  'settings.direction.right': 'Vuốt phải = chờ xoá',
  'settings.vertical': 'Vuốt dọc',
  'settings.vertical.hint':
    'Vuốt lên để thêm vào Yêu thích, vuốt xuống để xem lại ở cuối.',
  'settings.filters': 'Bộ lọc & sắp xếp',
  'settings.filters.open': 'Mở bộ lọc',
  'settings.reloadNote': 'Thay đổi sẽ tải lại bộ ảnh từ đầu.',
  'settings.album': 'Tên album chờ xoá',
  'settings.album.hint':
    'Ảnh bạn vuốt sang chờ xoá sẽ được thu thập vào album này trong app Ảnh.',
  'settings.album.renameHint':
    'Album vẫn đang tên « {current} ». Đổi sang « {suggested} »?',
  'settings.album.renameAction': 'Dùng « {suggested} »',
  'settings.album.renameWarning':
    'Ảnh đã thu thập trước đó vẫn nằm trong album cũ.',
  'settings.haptics': 'Rung phản hồi',
  'settings.haptics.hint': 'Rung nhẹ mỗi lần vuốt xong.',
  'settings.reset': 'Đặt lại',

  'detail.loading': 'Đang tải ảnh…',
  'detail.failed': 'Không tải được ảnh.',
  'detail.cloudOnly': 'Chỉ có trên iCloud',
  'detail.video': 'Video',
  'detail.dimensions': '{width} × {height}',
}

export type StringKey = keyof typeof vi

/**
 * Bases that have both a `_one` and an `_other` variant, so `I18n.tn` is
 * checked at compile time too.
 */
export type PluralKey = {
  [K in StringKey]: K extends `${infer Base}_other`
    ? `${Base}_one` extends StringKey
      ? Base
      : never
    : never
}[StringKey]

const en: Record<StringKey, string> = {
  'app.title': 'Photo Tidy',

  'common.left': 'left',
  'common.right': 'right',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.retry': 'Try again',
  'common.on': 'On',
  'common.off': 'Off',
  'common.nPhotos_one': '{count} photo',
  'common.nPhotos_other': '{count} photos',

  'perm.checking': 'Checking photo access…',
  'perm.denied.title': 'Photo access needed',
  'perm.denied.body':
    'This app needs access to your photo library to show and tidy your photos. Nothing ever leaves your device.',
  'perm.denied.settings': 'Open Settings',
  'perm.denied.recheck': 'Check again',
  'perm.limited.banner': 'Only {count} selected photos are available',
  'perm.limited.action': 'Manage',

  'header.settings': 'Settings',
  'header.filters': 'Filters',
  'header.progress': '{done} / {total}',
  'header.screenshots': 'Screenshots',

  'deck.loading': 'Loading photos…',
  'deck.empty.title': 'No photos',
  'deck.empty.body':
    'Your library is empty, or nothing matches the current filters.',
  'deck.empty.clear': 'Clear filters',
  'deck.done.title': 'All caught up!',
  'deck.done.body_one': 'You went through {count} photo.',
  'deck.done.body_other': 'You went through {count} photos.',
  'deck.done.restart': 'Start over',

  'card.badge.keep': 'KEEP',
  'card.badge.trash': 'TO DELETE',
  'card.badge.favorite': 'FAVORITE',
  'card.badge.later': 'LATER',
  'card.inAlbum': 'Already in the album',
  'card.cloud': 'iCloud',
  'card.screenshot': 'Screenshot',
  'card.favorite': 'Favorite',
  'card.open': 'Tap to enlarge',

  'footer.keep': 'Keep',
  'footer.trash': 'To delete',
  'footer.favorite': 'Favorite',
  'footer.later': 'Later',
  'footer.undo': 'Undo',
  'footer.review_one': 'Review {count} photo',
  'footer.review_other': 'Review {count} photos',
  'footer.reclaim': 'Frees ~{size}',
  'footer.syncing': 'Saving to the album…',

  'review.title': 'Review album',
  'review.subtitle': '{count} · {size}',
  'review.loading': 'Loading the album…',
  'review.error': 'Could not read the album “{album}”.',
  'review.hint': 'Tap a photo to take it back out of the album.',
  'review.empty.title': 'Nothing marked yet',
  'review.empty.body':
    'Swipe {trashSide} on the deck to collect photos into “{album}”.',
  'review.openPhotos': 'Open in the Photos app',
  'review.openPhotos.note':
    'The album “{album}” is ready in the Photos app. Open Photos → Albums → “{album}” to review and delete at your own pace.',
  'review.delete_one': 'Permanently delete {count} photo',
  'review.delete_other': 'Permanently delete {count} photos',
  'review.deleting': 'Deleting…',

  'confirm.title_one': 'Permanently delete {count} photo?',
  'confirm.title_other': 'Permanently delete {count} photos?',
  'confirm.body':
    'This cannot be undone. iOS will ask you to confirm one more time.',
  'confirm.freed': 'Frees about {size}.',
  'confirm.ok': 'Delete permanently',

  'toast.deleted_one': 'Deleted {count} photo · {size} freed',
  'toast.deleted_other': 'Deleted {count} photos · {size} freed',
  'toast.deleteCancelled': 'Cancelled. Your photos are still in “{album}”.',
  'toast.deleteFailed': 'Could not delete the photos. Please try again.',
  'toast.albumError': 'Could not update the album “{album}”.',
  'toast.unmarked': 'Taken out of the album',
  'toast.nothingToUndo': 'Nothing to undo',
  'toast.favorited': 'Added to Favourites',
  'toast.later': 'Moved to the end of the deck',
  'toast.favoriteFailed': 'Could not update Favourites',

  'sizeIndex.title': 'Scanning file sizes…',
  'sizeIndex.progress': '{indexed} / {total}',
  'sizeIndex.body':
    'Filtering or sorting by size needs a one-time scan of your library. You can cancel to go back to the previous filter.',
  'sizeIndex.cancel': 'Cancel and go back',
  'sizeIndex.waiting': 'Preparing the scan…',

  'filters.title': 'Filters & sorting',
  'filters.done': 'Done',
  'filters.clear': 'Clear filters',
  'filters.active_one': '{count} active filter',
  'filters.active_other': '{count} active filters',
  'filters.summary.none': 'No filters',
  'filters.media': 'Media',
  'filters.media.all': 'All',
  'filters.media.image': 'Photos only',
  'filters.media.video': 'Videos only',
  'filters.screenshotsOnly': 'Screenshots only',
  'filters.screenshotsOnly.hint':
    'The fastest win — screenshots pile up and are rarely worth keeping.',
  'filters.date': 'Date range',
  'filters.date.all': 'All',
  'filters.date.thisYear': 'This year',
  'filters.date.older1y': 'Older than 1 year',
  'filters.date.custom': 'Custom',
  'filters.date.from': 'From',
  'filters.date.to': 'To',
  'filters.size': 'File size',
  'filters.size.all': 'Any',
  'filters.size.over': 'Larger than {size}',
  'filters.size.custom': 'Custom',
  'filters.size.min': 'Minimum (MB)',
  'filters.size.max': 'Maximum (MB)',
  'filters.size.needsIndex':
    'Your library needs a one-time size scan before this can be applied.',
  'filters.sort': 'Sorting',
  'filters.sort.date': 'By date',
  'filters.sort.size': 'By size',
  'filters.order.newest': 'Newest first',
  'filters.order.oldest': 'Oldest first',
  'filters.order.largest': 'Largest first',
  'filters.order.smallest': 'Smallest first',

  'settings.title': 'Settings',
  'settings.done': 'Done',
  'settings.language': 'Ngôn ngữ / Language',
  'settings.language.vi': 'Tiếng Việt',
  'settings.language.en': 'English',
  'settings.direction': 'Swipe direction',
  'settings.direction.left': 'Swipe left = to delete',
  'settings.direction.right': 'Swipe right = to delete',
  'settings.vertical': 'Vertical swipes',
  'settings.vertical.hint':
    'Swipe up to add to Favourites, swipe down to see it again at the end.',
  'settings.filters': 'Filters & sorting',
  'settings.filters.open': 'Open filters',
  'settings.reloadNote': 'Changing this reloads the deck from the start.',
  'settings.album': 'Review album name',
  'settings.album.hint':
    'Photos you swipe to delete are collected into this album in the Photos app.',
  'settings.album.renameHint':
    'The album is still named “{current}”. Rename it to “{suggested}”?',
  'settings.album.renameAction': 'Use “{suggested}”',
  'settings.album.renameWarning':
    'Photos already collected stay in the old album.',
  'settings.haptics': 'Haptic feedback',
  'settings.haptics.hint': 'A light tap each time a swipe commits.',
  'settings.reset': 'Reset',

  'detail.loading': 'Loading the photo…',
  'detail.failed': 'Could not load the photo.',
  'detail.cloudOnly': 'iCloud only',
  'detail.video': 'Video',
  'detail.dimensions': '{width} × {height}',
}

export const STRINGS = { vi, en } satisfies Record<
  Language,
  Record<StringKey, string>
>
