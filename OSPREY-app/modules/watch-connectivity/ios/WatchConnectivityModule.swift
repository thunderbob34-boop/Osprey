// WatchConnectivityModule.swift
//
// Phone-side half of the OSPREY Watch bridge. The Watch-side counterpart
// (targets/watch/WorkoutDataModel.swift) already:
//   - listens for `didReceiveApplicationContext` / `didReceiveMessage` with
//     keys `status` (String), `elapsedSeconds` (Int), `heartRate` (Int?),
//     `distanceMiles` (Double?)
//   - sends `["action": "end_workout"]` via `sendMessage` when the wearer
//     taps "End Workout"
//
// This module exposes that contract to JS via the Expo Modules API:
//   - `updateApplicationContext(context:)` — phone -> watch, throttled by the
//     JS-side useWatchSync hook (Apple documents updateApplicationContext as a
//     low-frequency "latest state" channel, not a stream).
//   - `isPaired()` — lets JS decide whether it's worth showing any
//     "Watch connected" UI at all.
//   - `onEndWorkoutRequested` event — watch -> phone, fired when the wearer
//     taps "End Workout" on their wrist.
//
// Implementation note / one deliberate deviation from a "naive" reading of
// the Expo Modules API: `Module` (the class new Expo Modules subclass) is a
// typealias for `AnyModule & BaseModule`, and `BaseModule` (see
// node_modules/expo-modules-core/ios/Core/Modules/Module.swift) is a plain
// Swift class — it does NOT inherit from NSObject. `WCSessionDelegate`
// (like most Apple delegate protocols bridged from Objective-C) refines
// `NSObjectProtocol`, so `WatchConnectivityModule: Module, WCSessionDelegate`
// would not compile. Expo's own first-party modules hit the same issue for
// system delegate protocols and solve it by parking the delegate on a small
// dedicated `NSObject` subclass instead of the `Module` itself — see
// node_modules/expo-location/ios/Providers/BaseLocationProvider.swift
// (`internal class BaseLocationProvider: NSObject, CLLocationManagerDelegate`).
// `WatchSessionDelegateProxy` below mirrors that pattern: it is the actual
// `WCSessionDelegate`, and it forwards the one event the module cares about
// back to `WatchConnectivityModule` via a closure.
//
// UNVERIFIED: this file has not been compiled. It has not been checked by a
// real Xcode/Swift toolchain, an iOS simulator, or a physical paired Watch —
// none of those are available in this environment. Everything above and
// below is written to match real, installed `node_modules/expo-*/ios/*.swift`
// examples as closely as possible (Name/Events/AsyncFunction/Function/
// OnCreate syntax lifted from expo-haptics, expo-sensors' PedometerModule,
// expo-linking, and expo-secure-store — all read in full before writing this
// file) rather than guessed from memory, but a real build is the only way to
// confirm it actually compiles and links.

import ExpoModulesCore
import WatchConnectivity

private class WatchSessionDelegateProxy: NSObject, WCSessionDelegate {
  var onEndWorkoutRequested: (() -> Void)?

  // The only non-optional requirement of WCSessionDelegate.
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    // Nothing to do — updateApplicationContext / isPaired both read
    // WCSession.default's live state directly rather than caching it here.
  }

  // Real-time message from the Watch. The only message OSPREY's Watch app
  // ever sends is `["action": "end_workout"]` (see
  // targets/watch/WorkoutDataModel.swift's `requestEndWorkout()`), with no
  // reply handler, so we don't implement the `replyHandler:` overload.
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    guard message["action"] as? String == "end_workout" else { return }
    DispatchQueue.main.async { [weak self] in
      self?.onEndWorkoutRequested?()
    }
  }

  #if os(iOS)
  // iOS-only: required so WCSession keeps working if the user switches to a
  // different paired Watch. Not part of the app's feature contract, but
  // skipping it is a well-known footgun (Apple's own docs call this out for
  // any iOS app that implements WCSessionDelegate).
  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }
  #endif
}

public class WatchConnectivityModule: Module {
  private let delegateProxy = WatchSessionDelegateProxy()

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivity")

    Events("onEndWorkoutRequested")

    OnCreate {
      delegateProxy.onEndWorkoutRequested = { [weak self] in
        self?.sendEvent("onEndWorkoutRequested", [:])
      }

      guard WCSession.isSupported() else { return }
      WCSession.default.delegate = delegateProxy
      WCSession.default.activate()
    }

    // Phone -> Watch. Must never throw across the JS bridge: no paired Watch,
    // no Watch app installed, or the session simply not being reachable yet
    // are all normal, expected states during a workout — not error states the
    // calling screen should have to handle.
    AsyncFunction("updateApplicationContext") { (context: [String: Any]) in
      guard WCSession.isSupported() else { return }
      try? WCSession.default.updateApplicationContext(context)
    }

    // Sync — cheap enough (no I/O) to call directly rather than as an
    // AsyncFunction. See node_modules/expo-secure-store/ios/SecureStoreModule.swift's
    // `canUseBiometricAuthentication` for the same sync-Function-returning-Bool shape.
    Function("isPaired") { () -> Bool in
      WCSession.isSupported() && WCSession.default.isPaired
    }
  }
}
