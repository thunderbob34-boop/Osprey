import SwiftUI

struct ContentView: View {
    @EnvironmentObject var workoutData: WorkoutDataModel

    var body: some View {
        VStack(spacing: 8) {
            Text("🦅 OSPREY")
                .font(.headline)
                .foregroundColor(.orange)

            Text(formattedElapsed)
                .font(.system(size: 36, weight: .bold, design: .monospaced))
                .foregroundColor(.white)

            if let bpm = workoutData.heartRate {
                HStack {
                    Text("❤️")
                    Text("\(bpm) bpm")
                        .foregroundColor(.red)
                }
                .font(.subheadline)
            }

            if let miles = workoutData.distanceMiles {
                Text(String(format: "%.2f mi", miles))
                    .font(.subheadline)
                    .foregroundColor(.gray)
            }

            statusBadge

            Button(action: {
                workoutData.requestEndWorkout()
            }) {
                Text("End Workout")
                    .font(.callout)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.red)
                    .cornerRadius(20)
            }
            .padding(.top, 4)
        }
        .padding()
    }

    private var formattedElapsed: String {
        let s = workoutData.elapsedSeconds
        let h = s / 3600
        let m = (s % 3600) / 60
        let sec = s % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, sec)
        }
        return String(format: "%d:%02d", m, sec)
    }

    @ViewBuilder
    private var statusBadge: some View {
        let label: String
        let color: Color
        switch workoutData.status {
        case "active":
            label = "ACTIVE"
            color = .green
        case "paused":
            label = "PAUSED"
            color = .yellow
        default:
            label = "IDLE"
            color = .gray
        }
        Text(label)
            .font(.caption)
            .fontWeight(.bold)
            .foregroundColor(color)
    }
}
