import SwiftUI
import WatchConnectivity

@main
struct OspreyWatchApp: App {
    @StateObject var workoutData = WorkoutDataModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(workoutData)
        }
    }
}
