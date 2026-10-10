import UIKit
import Capacitor

/// The bridge view controller, with the page's colour behind the web view (ADR-109).
///
/// Capacitor paints the web view's own background `systemBackground` — white in light mode, black in
/// dark — and wherever iOS insets the page, under the status bar on iOS 27, that is what shows. Here
/// the native background is the app's paper or night from the first frame, following the system's
/// appearance until the page says which theme it chose.
class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(PageChromePlugin())
        applyPageColor(AppViewController.systemPageColor)
    }

    /// Paper in light mode, night in dark: `THEME_COLOR` in `src/lib/theme.ts`.
    static let systemPageColor = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x15 / 255, green: 0x12 / 255, blue: 0x0e / 255, alpha: 1)
            : UIColor(red: 0xf4 / 255, green: 0xef / 255, blue: 0xe6 / 255, alpha: 1)
    }

    func applyPageColor(_ color: UIColor) {
        view.backgroundColor = color
        webView?.backgroundColor = color
        webView?.scrollView.backgroundColor = color
        view.window?.backgroundColor = color
    }
}

/// Lets the page set the colour behind it and the status bar's text to match its theme.
@objc(PageChromePlugin)
class PageChromePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "PageChromePlugin"
    let jsName = "PageChrome"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setTheme", returnType: CAPPluginReturnPromise)
    ]

    /// `{ color: "#rrggbb", dark: boolean }`: the page's background, and whether it is the dark one.
    @objc func setTheme(_ call: CAPPluginCall) {
        guard let color = UIColor(hex: call.getString("color") ?? "") else {
            call.reject("color must be #rrggbb")
            return
        }
        let dark = call.getBool("dark") ?? false
        DispatchQueue.main.async {
            guard let controller = self.bridge?.viewController as? AppViewController else {
                call.resolve()
                return
            }
            controller.applyPageColor(color)
            controller.setStatusBarStyle(dark ? .lightContent : .darkContent)
            call.resolve()
        }
    }
}

private extension UIColor {
    convenience init?(hex: String) {
        let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        self.init(
            red: CGFloat((value >> 16) & 0xff) / 255,
            green: CGFloat((value >> 8) & 0xff) / 255,
            blue: CGFloat(value & 0xff) / 255,
            alpha: 1
        )
    }
}
