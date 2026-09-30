# PhotoSwipe — iOS Setup

[English](#english) | [Tiếng Việt](#tiếng-việt)

---

## English

### Safety model — read this first

**A swipe never deletes anything.**

1. Swiping "trash" (left by default) adds the photo to a real album in your iOS
   photo library — it does **not** delete it. The photo stays exactly where it
   was; it just gains an album membership. Swiping it back out (undo) removes
   that membership again.
2. You review that album whenever you like — inside the app's review screen, or
   in Apple's own Photos app.
3. Deleting is a **separate, explicit step** from the review screen. Even then,
   iOS puts up its own system confirmation dialog, and deleted photos land in
   "Recently Deleted" for 30 days.

The default album name is **"Chờ xoá"** in Vietnamese and **"To Delete"** in
English. It is seeded from your device locale on first launch and can be changed
at any time in the app's settings screen. Changing the app language later does
**not** rename an album that already exists — that would orphan the photos you
have already collected.

Other swipes: up = mark as favourite (and keep), down = skip for now (purely
in-app, never touches your library).

### Prerequisites

Xcode **16.2** is installed at `/Applications/Xcode.app` and the project builds
with it (verified for both the simulator and the device SDK).

`xcode-select` still points at the Command Line Tools, so unless you run
`sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer` once,
every command-line build must be prefixed with `DEVELOPER_DIR`:

```sh
cd ios/App
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -scheme App -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug build CODE_SIGNING_ALLOWED=NO
```

Building from the Xcode GUI needs no such prefix.

**CocoaPods is not required.** Capacitor 8 generates a Swift Package Manager
project (`ios/App/CapApp-SPM`), so Xcode resolves the Capacitor dependency
itself the first time you open the workspace. There is no `Podfile`.

### ⚠️ Toolchain mismatch: Capacitor 8.5.2 expects Xcode 26

Capacitor 8.5.2 ships its iOS runtime as a **prebuilt XCFramework** compiled
with **Swift 6.2 (Xcode 26)**. Xcode 16.2 uses Swift 6.0.3, which does not
recognise the `$NonescapableTypes` feature flag that the newer compiler writes
into the framework's `.swiftinterface`. Every declaration guarded by it is
therefore silently invisible to Xcode 16.2 — including
`CAPPluginCall.reject(...)`, the optional-returning option accessors
(`getString(_:)`, `getInt(_:)`, `getValue(_:)`, the generic `getArray(_:_:)`),
and `CAPBridgeViewController.bridge`.

This is a property of the published binary, not of this project: a three-line
Swift file compiled with plain `swiftc` against the XCFramework reproduces it.

`PhotoLibraryPlugin.swift` and `PhotoSwipeViewController.swift` therefore use
only the equivalent **unguarded** public APIs (`call.dictionaryRepresentation`
for reading options, `call.unavailable(_:)` for rejecting, and the bridge
reached via the web view's delegation handler). Each is documented inline.

**This code is forward-compatible** — those APIs behave identically on Xcode 26.
If you upgrade to Xcode 26 you may optionally simplify the helpers back to the
idiomatic accessors, but nothing will break if you don't.

One visible consequence: rejected plugin promises arrive in JS with
`code: "UNAVAILABLE"` instead of a bespoke code. The human-readable `message`
is exactly as written in the Swift.

### One-time: register the localization files in Xcode

The iOS permission prompt is drawn by the system, not by our web UI, so it is
localized natively through `InfoPlist.strings`. Those files exist and are
already referenced from `project.pbxproj`, so this should just work. If Xcode
ever shows the English prompt on a Vietnamese device, verify the wiring:

- In Xcode, select the **App** target → **Build Phases** → **Copy Bundle
  Resources**, and confirm `InfoPlist.strings` is listed (it should show `en`
  and `vi` variants underneath it in the Project navigator).
- If it is missing, drag `ios/App/App/en.lproj` and `ios/App/App/vi.lproj` into
  the **App** group in the Project navigator, ticking the **App** target.

### Build and run

```sh
npm install
npm run ios      # build + cap sync ios + cap open ios
```

Individual steps, if you prefer:

```sh
npm run build          # Vite build into dist/
npx cap sync ios       # copy dist/ into the native project + update plugins
npx cap open ios       # open ios/App/App.xcodeproj in Xcode
```

`npm run sync` does the first two without opening Xcode.

> `cap sync` requires `dist/index.html` to exist, so always build first. The npm
> scripts above already do that for you.

### Running on a real device with a free Apple ID

You do **not** need a paid Apple Developer account.

1. In Xcode: **Settings → Accounts → +** and sign in with your Apple ID.
2. Select the **App** target → **Signing & Capabilities**:
   - Tick **Automatically manage signing**.
   - Pick your personal team (shown as *"Your Name (Personal Team)"*).
   - If you get a bundle-identifier conflict, change **Bundle Identifier** to
     something unique, e.g. `com.yourname.photoswipe`. Keep it in sync with
     `appId` in `capacitor.config.ts`.
3. Plug in your iPhone, unlock it, and tap **Trust This Computer**.
4. Choose your iPhone in the run-destination dropdown and press **⌘R**.
5. The first launch will fail with *"Untrusted Developer"*. On the iPhone go to
   **Settings → General → VPN & Device Management**, tap your Apple ID, and
   choose **Trust**. Then run again.

Free-provisioning caveats: the app expires after **7 days** (rebuild from Xcode
to renew), and you are limited to a few apps per device.

### Testing notes

**Use a real device.** The iOS Simulator's photo library contains only Apple's
handful of sample images, so you cannot meaningfully test paging, the size
index, screenshot filtering or real deletion there. Deletion in the simulator
also behaves differently from a real device.

Grant **Full Access** when prompted rather than *Limited* — with limited access
PhotoKit only ever sees the subset you picked, so totals, filters and the size
index all describe that subset rather than your library.

### The size index

Filtering or sorting by file size needs data PhotoKit will not give us in a
query, so the app measures every asset once in a background scan and caches the
result to disk (`Application Support/PhotoSwipe/size-index.json`). On a large
library the first scan takes a while; the settings screen shows its progress.
Until it finishes, size-based requests fall back to a date-sorted result flagged
as pending. The index reconciles itself on launch: deleted assets are dropped
and newly added ones are measured.

### Dev loop without a device

```sh
npm run dev
```

In a desktop browser the plugin resolves to a mock (`src/photos/webMock.ts`)
that synthesises ~60 fake photos with canvas-drawn thumbnails, a simulated size
index, and working album/favourite behaviour. No native build needed.

---

## Tiếng Việt

### Mô hình an toàn — đọc phần này trước

**Vuốt không bao giờ xoá ảnh.**

1. Vuốt "bỏ" (mặc định là vuốt trái) chỉ thêm ảnh vào một album thật trong thư
   viện ảnh iOS — **không** xoá. Ảnh vẫn nằm nguyên chỗ cũ, chỉ có thêm một
   album chứa nó. Vuốt ngược lại (hoàn tác) sẽ gỡ ảnh khỏi album đó.
2. Bạn xem lại album này bất cứ lúc nào — trong màn hình duyệt lại của ứng
   dụng, hoặc trong ứng dụng Ảnh của Apple.
3. Việc xoá là **một bước riêng, phải xác nhận rõ ràng** từ màn hình duyệt lại.
   Ngay cả khi đó, iOS vẫn hiện hộp thoại xác nhận của hệ thống, và ảnh đã xoá
   còn nằm trong "Đã xoá gần đây" 30 ngày.

Tên album mặc định là **"Chờ xoá"** với tiếng Việt và **"To Delete"** với tiếng
Anh. Tên này được chọn theo ngôn ngữ của thiết bị trong lần chạy đầu tiên, và
đổi được bất cứ lúc nào trong màn hình cài đặt của ứng dụng. Đổi ngôn ngữ về sau
sẽ **không** đổi tên album đã tồn tại — làm vậy sẽ bỏ rơi những ảnh bạn đã gom.

Các hướng vuốt khác: lên = đánh dấu yêu thích (và giữ lại), xuống = tạm bỏ qua
(chỉ trong ứng dụng, không đụng vào thư viện ảnh).

### Yêu cầu chuẩn bị

Xcode **16.2** đã được cài tại `/Applications/Xcode.app` và dự án build được
với phiên bản này (đã kiểm chứng cho cả simulator lẫn SDK máy thật).

`xcode-select` vẫn đang trỏ vào Command Line Tools, nên nếu bạn chưa chạy
`sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer` thì mọi
lệnh build từ dòng lệnh đều phải thêm tiền tố `DEVELOPER_DIR`:

```sh
cd ios/App
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -scheme App -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug build CODE_SIGNING_ALLOWED=NO
```

Build từ giao diện Xcode thì không cần tiền tố này.

**Không cần CocoaPods.** Capacitor 8 sinh ra dự án dùng Swift Package Manager
(`ios/App/CapApp-SPM`), nên Xcode tự tải phụ thuộc Capacitor trong lần mở đầu
tiên. Dự án không có `Podfile`.

### ⚠️ Lệch phiên bản trình biên dịch: Capacitor 8.5.2 mong đợi Xcode 26

Capacitor 8.5.2 phát hành phần chạy iOS dưới dạng **XCFramework biên dịch sẵn**
bằng **Swift 6.2 (Xcode 26)**. Xcode 16.2 dùng Swift 6.0.3, vốn không nhận biết
cờ tính năng `$NonescapableTypes` mà trình biên dịch mới ghi vào tệp
`.swiftinterface` của framework. Vì vậy mọi khai báo nằm trong cờ đó đều **vô
hình** với Xcode 16.2 — bao gồm `CAPPluginCall.reject(...)`, các hàm đọc tham số
trả về Optional (`getString(_:)`, `getInt(_:)`, `getValue(_:)`, bản generic của
`getArray(_:_:)`) và `CAPBridgeViewController.bridge`.

Đây là đặc tính của bản nhị phân được phát hành, không phải lỗi cấu hình của dự
án: chỉ cần một tệp Swift ba dòng biên dịch bằng `swiftc` với XCFramework đó là
tái hiện được.

Do đó `PhotoLibraryPlugin.swift` và `PhotoSwipeViewController.swift` chỉ dùng
các API công khai **không bị che** tương đương (`call.dictionaryRepresentation`
để đọc tham số, `call.unavailable(_:)` để báo lỗi, và lấy bridge thông qua
delegation handler của web view). Mỗi chỗ đều có chú thích ngay trong mã.

**Mã này tương thích về sau** — các API đó hoạt động y hệt trên Xcode 26. Nếu
nâng lên Xcode 26, bạn có thể (không bắt buộc) rút gọn lại về các hàm truy cập
quen thuộc; không nâng cũng không sao.

Một hệ quả dễ thấy: promise bị từ chối sẽ về JS với `code: "UNAVAILABLE"` thay
vì mã lỗi riêng. Phần `message` cho người đọc vẫn đúng như viết trong Swift.

### Một lần duy nhất: đăng ký file bản địa hoá trong Xcode

Hộp thoại xin quyền là do iOS vẽ chứ không phải giao diện web của chúng ta, nên
phải bản địa hoá ở tầng native qua `InfoPlist.strings`. Các file này đã có sẵn
và đã được khai báo trong `project.pbxproj`, nên bình thường sẽ chạy ngay. Nếu
máy tiếng Việt vẫn hiện thông báo tiếng Anh, hãy kiểm tra lại:

- Trong Xcode, chọn target **App** → **Build Phases** → **Copy Bundle
  Resources**, xác nhận có `InfoPlist.strings` (ở Project navigator sẽ thấy hai
  biến thể `en` và `vi` bên dưới).
- Nếu thiếu, kéo hai thư mục `ios/App/App/en.lproj` và `ios/App/App/vi.lproj`
  vào nhóm **App** trong Project navigator, nhớ tích chọn target **App**.

### Build và chạy

```sh
npm install
npm run ios      # build + cap sync ios + cap open ios
```

Hoặc chạy từng bước:

```sh
npm run build          # Vite build ra thư mục dist/
npx cap sync ios       # chép dist/ sang dự án native + cập nhật plugin
npx cap open ios       # mở ios/App/App.xcodeproj bằng Xcode
```

`npm run sync` chạy hai bước đầu mà không mở Xcode.

> `cap sync` cần có `dist/index.html`, nên luôn build trước. Các script npm ở
> trên đã lo việc này rồi.

### Chạy trên máy thật với Apple ID miễn phí

Bạn **không** cần tài khoản Apple Developer trả phí.

1. Trong Xcode: **Settings → Accounts → +** rồi đăng nhập Apple ID.
2. Chọn target **App** → **Signing & Capabilities**:
   - Tích **Automatically manage signing**.
   - Chọn team cá nhân của bạn (hiển thị dạng *"Tên bạn (Personal Team)"*).
   - Nếu báo trùng bundle identifier, đổi **Bundle Identifier** thành một giá
     trị riêng, ví dụ `com.tenban.photoswipe`. Nhớ sửa `appId` trong
     `capacitor.config.ts` cho khớp.
3. Cắm iPhone, mở khoá máy và bấm **Tin cậy máy tính này**.
4. Chọn iPhone của bạn ở ô chọn thiết bị rồi bấm **⌘R**.
5. Lần chạy đầu sẽ báo lỗi *"Untrusted Developer"*. Trên iPhone vào **Cài đặt →
   Cài đặt chung → VPN & Quản lý thiết bị**, chạm vào Apple ID của bạn và chọn
   **Tin cậy**. Sau đó chạy lại.

Lưu ý khi dùng tài khoản miễn phí: ứng dụng hết hạn sau **7 ngày** (build lại từ
Xcode để gia hạn), và mỗi thiết bị chỉ cài được vài ứng dụng dạng này.

### Ghi chú khi kiểm thử

**Hãy dùng máy thật.** Thư viện ảnh của iOS Simulator chỉ có vài ảnh mẫu của
Apple, nên không thể kiểm thử thật sự việc phân trang, chỉ mục dung lượng, lọc
ảnh chụp màn hình hay xoá ảnh. Hành vi xoá trên simulator cũng khác máy thật.

Khi được hỏi quyền, hãy chọn **Toàn quyền truy cập** thay vì *Giới hạn* — với
quyền giới hạn, PhotoKit chỉ nhìn thấy đúng số ảnh bạn đã chọn, nên tổng số,
bộ lọc và chỉ mục dung lượng đều chỉ phản ánh phần đó chứ không phải cả thư
viện.

### Chỉ mục dung lượng

Lọc hoặc sắp xếp theo dung lượng file cần dữ liệu mà PhotoKit không cung cấp
trong truy vấn, nên ứng dụng phải quét đo từng ảnh một lần ở chế độ nền rồi lưu
kết quả xuống đĩa (`Application Support/PhotoSwipe/size-index.json`). Với thư
viện lớn, lần quét đầu tiên khá lâu; màn hình cài đặt hiển thị tiến độ. Trong
lúc chưa xong, các yêu cầu liên quan đến dung lượng sẽ trả về kết quả sắp theo
ngày kèm cờ báo "đang xử lý". Chỉ mục tự đối chiếu lại mỗi lần khởi động: ảnh đã
xoá bị loại bỏ, ảnh mới thêm được đo bổ sung.

### Vòng lặp phát triển khi không có máy thật

```sh
npm run dev
```

Trên trình duyệt máy tính, plugin sẽ tự dùng bản giả lập
(`src/photos/webMock.ts`): sinh ra khoảng 60 ảnh giả với hình thu nhỏ vẽ bằng
canvas, chỉ mục dung lượng mô phỏng, cùng đầy đủ hành vi album và yêu thích.
Không cần build native.
