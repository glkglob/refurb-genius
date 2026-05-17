import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    /// Performs final app initialization after launch.
    /// - Parameters:
    ///   - application: The singleton app object.
    ///   - launchOptions: A dictionary indicating why the app was launched (may be `nil`).
    /// - Returns: `true` to indicate successful launch and allow normal continuation, `false` otherwise.
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    /// Called when the app is about to move from the active to the inactive state.
    /// Use this to pause ongoing tasks, disable timers, and throttle down resource-intensive work (for example, pause a game).
    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    /// Called when the app transitions to the background.
    /// 
    /// Use this method to release shared resources, save user data, invalidate timers, and store enough application state to restore the app to its current state if it is later terminated. If the app supports background execution, this method is called instead of `applicationWillTerminate(_:)` when the user quits.
    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    /// Notifies the delegate that the app is transitioning from the background to the foreground.
    /// 
    /// Called as part of the transition to the active state; undo or refresh changes made when the app entered the background.
    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    /// Notifies the app that it has moved to the active state, where paused tasks can be resumed and the user interface can be refreshed if needed.
    /// - Parameter application: The singleton app object managing the app’s lifecycle.
    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    /// Performs final cleanup before the app terminates, such as saving data and releasing resources.
    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    /// Processes a URL used to open the app.
    /// - Parameters:
    ///   - app: The application instance receiving the URL.
    ///   - url: The URL that was used to open the app.
    ///   - options: A dictionary of keys providing context about how the URL was opened.
    /// - Returns: `true` if the URL was handled, `false` otherwise.
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    /// Handle continuation of a user activity (for example, a Universal Link).
    /// - Parameters:
    ///   - userActivity: The activity to continue (for example, an `NSUserActivity` representing a Universal Link).
    ///   - restorationHandler: A closure to supply objects that can restore state related to the activity.
    /// - Returns: `true` if the activity was handled, `false` otherwise.
    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
