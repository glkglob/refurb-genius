import AuthenticationServices
import Capacitor
import Foundation
import UIKit

/// Minimal first-party ASWebAuthenticationSession bridge (IOS-READINESS-2B-1).
///
/// Opens an auth URL and returns the callback URL string to JS.
/// Does **not** implement OAuth providers, PKCE, token exchange, or persistence.
/// Does **not** log URL query/fragment contents.
@objc(WebAuthSessionPlugin)
public class WebAuthSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WebAuthSessionPlugin"
    public let jsName = "WebAuthSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openAuthSession", returnType: CAPPluginReturnPromise)
    ]

    private var authSession: ASWebAuthenticationSession?
    private var presentationContextProvider: WebAuthPresentationContextProvider?

    @objc func openAuthSession(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing or invalid url")
            return
        }
        guard let callbackScheme = call.getString("callbackScheme"), !callbackScheme.isEmpty else {
            call.reject("Missing callbackScheme")
            return
        }

        // Never log url / callback URL contents (query/fragment may hold auth secrets later).
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if self.authSession != nil {
                call.reject("Auth session already in progress")
                return
            }

            let provider = WebAuthPresentationContextProvider(window: self.bridge?.webView?.window)
            self.presentationContextProvider = provider

            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { [weak self] callbackURL, error in
                self?.authSession = nil
                self?.presentationContextProvider = nil

                if let error = error as? ASWebAuthenticationSessionError,
                   error.code == .canceledLogin {
                    call.resolve([
                        "type": "cancel"
                    ])
                    return
                }

                if error != nil {
                    // Do not surface raw system error strings that might include URL material.
                    call.reject("Auth session failed")
                    return
                }

                if let callbackURL = callbackURL {
                    call.resolve([
                        "type": "success",
                        "url": callbackURL.absoluteString
                    ])
                    return
                }

                call.resolve([
                    "type": "cancel"
                ])
            }

            session.presentationContextProvider = provider
            // Non-ephemeral: system may use shared web credentials where available.
            // 2B contract does not assume cookie sharing into WKWebView.
            session.prefersEphemeralWebBrowserSession = false

            self.authSession = session
            if !session.start() {
                self.authSession = nil
                self.presentationContextProvider = nil
                call.reject("Failed to start auth session")
            }
        }
    }
}

private final class WebAuthPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    private weak var window: UIWindow?

    init(window: UIWindow?) {
        self.window = window
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let window = window {
            return window
        }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        if let key = scenes.flatMap(\.windows).first(where: \.isKeyWindow) {
            return key
        }
        if let any = scenes.flatMap(\.windows).first {
            return any
        }
        return ASPresentationAnchor()
    }
}

/// Capacitor 8 local-plugin registration host (subclass of CAPBridgeViewController).
/// Wired from Main.storyboard so `WebAuthSession` is available to JS.
@objc(AppBridgeViewController)
public class AppBridgeViewController: CAPBridgeViewController {
    open override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(WebAuthSessionPlugin())
    }
}
