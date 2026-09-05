import SwiftUI
import WidgetKit

// MARK: - Data model (mirroir de src/lib/widgetKit.ts)

private let appGroup = "group.com.horsetrack.app"
private let widgetKey = "widgetData"

struct WidgetData: Codable {
    let horseName: String
    let todaySessionTitle: String?
    let todaySessionDurationMin: Int?
    let todaySessionTime: String?
    let weeklyDone: Int
    let weeklyTotal: Int

    static let placeholder = WidgetData(
        horseName: "Tornado",
        todaySessionTitle: "Travail à la longe",
        todaySessionDurationMin: 45,
        todaySessionTime: "09h00",
        weeklyDone: 3,
        weeklyTotal: 5
    )
}

// MARK: - Timeline

struct HorsetrackEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct HorsetrackProvider: TimelineProvider {
    func placeholder(in context: Context) -> HorsetrackEntry {
        HorsetrackEntry(date: .now, data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (HorsetrackEntry) -> Void) {
        completion(HorsetrackEntry(date: .now, data: load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HorsetrackEntry>) -> Void) {
        let entry = HorsetrackEntry(date: .now, data: load())
        // Actualise toutes les heures — l'app pousse aussi une mise à jour
        // immédiate via WidgetCenter.reloadAllTimelines() dès que les données changent.
        let refresh = Calendar.current.date(byAdding: .hour, value: 1, to: .now) ?? .now
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    private func load() -> WidgetData {
        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let json = defaults.string(forKey: widgetKey),
            let jsonData = json.data(using: .utf8),
            let decoded = try? JSONDecoder().decode(WidgetData.self, from: jsonData)
        else { return .placeholder }
        return decoded
    }
}

// MARK: - Small widget (2×2)

struct SmallView: View {
    let data: WidgetData

    private var progress: Double {
        guard data.weeklyTotal > 0 else { return 0 }
        return Double(data.weeklyDone) / Double(data.weeklyTotal)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // En-tête : emoji + nom du cheval
            HStack(spacing: 4) {
                Text("🐴").font(.system(size: 13))
                Text(data.horseName)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 6)

            // Séance du jour
            if let title = data.todaySessionTitle {
                Text(title)
                    .font(.system(size: 13, weight: .bold))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                if let time = data.todaySessionTime {
                    Text(time)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .padding(.top, 2)
                }
            } else {
                Text("Repos 🌿")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)

            // Barre de progression hebdomadaire
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(.secondary.opacity(0.2))
                        .frame(height: 4)
                    Capsule()
                        .fill(Color.accentColor)
                        .frame(width: geo.size.width * progress, height: 4)
                }
            }
            .frame(height: 4)

            Text("\(data.weeklyDone)/\(data.weeklyTotal) séances")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .padding(.top, 3)
        }
        .padding(12)
    }
}

// MARK: - Medium widget (4×2)

struct MediumView: View {
    let data: WidgetData

    private var progress: Double {
        guard data.weeklyTotal > 0 else { return 0 }
        return Double(data.weeklyDone) / Double(data.weeklyTotal)
    }

    private var progressPct: Int { Int(progress * 100) }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // Colonne gauche : progression hebdomadaire
            VStack(alignment: .leading, spacing: 4) {
                Text("🐴 \(data.horseName)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                Spacer()

                Text("\(progressPct)%")
                    .font(.system(size: 34, weight: .black))
                    .foregroundStyle(Color.accentColor)
                    .minimumScaleFactor(0.7)

                Text("de la semaine")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(.secondary.opacity(0.2))
                            .frame(height: 4)
                        Capsule()
                            .fill(Color.accentColor)
                            .frame(width: geo.size.width * progress, height: 4)
                    }
                }
                .frame(height: 4)

                Text("\(data.weeklyDone)/\(data.weeklyTotal) séances")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .padding(.top, 1)
            }

            // Séparateur vertical
            Rectangle()
                .fill(.secondary.opacity(0.2))
                .frame(width: 1)

            // Colonne droite : séance du jour
            VStack(alignment: .leading, spacing: 4) {
                Text("AUJOURD'HUI")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .kerning(0.5)

                Spacer()

                if let title = data.todaySessionTitle {
                    Text(title)
                        .font(.system(size: 14, weight: .bold))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)

                    if let time = data.todaySessionTime {
                        Label(time, systemImage: "clock")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .padding(.top, 2)
                    }
                    if let duration = data.todaySessionDurationMin {
                        Label("\(duration) min", systemImage: "timer")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Text("Repos 🌿")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.secondary)
                    Text("Pas de séance prévue")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .padding(.top, 2)
                }

                Spacer()
            }
        }
        .padding(14)
    }
}

// MARK: - Entry view (dispatch par taille)

struct HorsetrackWidgetEntryView: View {
    let entry: HorsetrackEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallView(data: entry.data)
        default:
            MediumView(data: entry.data)
        }
    }
}

// MARK: - Widget declaration

@main
struct HorsetrackWidget: Widget {
    let kind = "HorsetrackWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HorsetrackProvider()) { entry in
            HorsetrackWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Horsetrack")
        .description("Ta séance du jour et ta progression de la semaine.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    HorsetrackWidget()
} timeline: {
    HorsetrackEntry(date: .now, data: .placeholder)
    HorsetrackEntry(date: .now, data: WidgetData(
        horseName: "Jazz",
        todaySessionTitle: nil,
        todaySessionDurationMin: nil,
        todaySessionTime: nil,
        weeklyDone: 5,
        weeklyTotal: 5
    ))
}

#Preview("Medium", as: .systemMedium) {
    HorsetrackWidget()
} timeline: {
    HorsetrackEntry(date: .now, data: .placeholder)
    HorsetrackEntry(date: .now, data: WidgetData(
        horseName: "Quabar des Monts",
        todaySessionTitle: nil,
        todaySessionDurationMin: nil,
        todaySessionTime: nil,
        weeklyDone: 0,
        weeklyTotal: 4
    ))
}
