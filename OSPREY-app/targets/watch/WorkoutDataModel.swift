import Foundation
import WatchConnectivity

class WorkoutDataModel: NSObject, ObservableObject, WCSessionDelegate {
    @Published var elapsedSeconds: Int = 0
    @Published var heartRate: Int? = nil
    @Published var distanceMiles: Double? = nil
    @Published var status: String = "idle"

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // Receive live context updates from the phone (sendWorkoutUpdate)
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async {
            self.status = applicationContext["status"] as? String ?? "idle"
            self.elapsedSeconds = applicationContext["elapsedSeconds"] as? Int ?? 0
            self.heartRate = applicationContext["heartRate"] as? Int
            self.distanceMiles = applicationContext["distanceMiles"] as? Double
        }
    }

    // Receive real-time message replies (if phone uses sendMessage instead of context)
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async {
            if let status = message["status"] as? String {
                self.status = status
            }
            if let elapsed = message["elapsedSeconds"] as? Int {
                self.elapsedSeconds = elapsed
            }
            self.heartRate = message["heartRate"] as? Int
            self.distanceMiles = message["distanceMiles"] as? Double
        }
    }

    func requestEndWorkout() {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["action": "end_workout"], replyHandler: nil, errorHandler: nil)
    }

    // Required WCSessionDelegate stubs
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
}
