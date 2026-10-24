import AppTrackingTransparency
import ExpoModulesCore
import TikTokBusinessSDK

// Bridge to the TikTok App Events SDK. The JS side asks for App Tracking
// Transparency first and only initializes the SDK once tracking is allowed.
public class SparrTikTokModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SparrTikTok")

    // Shows the ATT prompt once; later calls return the stored decision.
    // Returns "notDetermined" without a prompt while another system alert is open.
    AsyncFunction("requestTrackingPermission") { (promise: Promise) in
      ATTrackingManager.requestTrackingAuthorization { status in
        promise.resolve(SparrTikTokModule.label(status))
      }
    }.runOnQueue(.main)

    AsyncFunction("initialize") { (appId: String, tiktokAppId: String, accessToken: String, debug: Bool, promise: Promise) in
      guard let config = TikTokConfig(accessToken: accessToken, appId: appId, tiktokAppId: tiktokAppId) else {
        promise.reject("ERR_TIKTOK_CONFIG", "TikTok config could not be created")
        return
      }
      if debug {
        config.enableDebugMode()
      }
      TikTokBusiness.initializeSdk(config, completionHandler: { success, error in
        if success {
          promise.resolve(true)
        } else {
          promise.reject("ERR_TIKTOK_INIT", error?.localizedDescription ?? "TikTok SDK init failed")
        }
      })
    }.runOnQueue(.main)

    Function("trackEvent") { (name: String) in
      TikTokBusiness.trackTTEvent(TikTokBaseEvent(eventName: name))
    }
  }

  private static func label(_ status: ATTrackingManager.AuthorizationStatus) -> String {
    switch status {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "denied"
    }
  }
}
