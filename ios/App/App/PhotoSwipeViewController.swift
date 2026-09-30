import Capacitor
import UIKit
import WebKit

/// Capacitor auto-registers plugins listed in `capacitor.config.json`'s
/// `packageClassList`, which only ever contains plugins shipped as npm
/// packages. `PhotoLibraryPlugin` lives inside this app target, so it has to be
/// registered by hand — `capacitorDidLoad()` runs right after the bridge is
/// built and before the web view loads, which is the correct hook.
class PhotoSwipeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // The obvious spelling here is `bridge?.registerPluginInstance(...)`,
        // but `CAPBridgeViewController.bridge` is invisible to this toolchain
        // (see the TOOLCHAIN NOTE in PhotoLibraryPlugin.swift). We therefore
        // reach the same bridge object by the other public route.
        //
        // This is safe and deterministic given CAPBridgeViewController.loadView():
        //   1. prepareWebView(...) sets `webView.navigationDelegate` to the
        //      WebViewDelegationHandler,
        //   2. CapacitorBridge.init(...) sets `delegationHandler.bridge = self`,
        //   3. capacitorDidLoad() is called — i.e. only after both of the above.
        guard let handler = webView?.navigationDelegate as? WebViewDelegationHandler,
              let bridge = handler.bridge else {
            // Fail loudly: a silently unregistered plugin surfaces in JS as the
            // baffling "PhotoLibrary plugin is not implemented on ios".
            assertionFailure("PhotoSwipe: could not reach the Capacitor bridge to register PhotoLibraryPlugin.")
            CAPLog.print("⚡️ ❌ PhotoSwipe: PhotoLibraryPlugin was NOT registered — the bridge was unreachable.")
            return
        }
        bridge.registerPluginInstance(PhotoLibraryPlugin())
    }
}
