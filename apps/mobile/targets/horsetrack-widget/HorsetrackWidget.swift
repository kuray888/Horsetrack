import SwiftUI
import WidgetKit

// MARK: - Données (miroir de src/lib/widgetData.ts)

private let appGroup = "group.com.horsetrack.app"
private let widgetKey = "widgetData"

/// Champs ajoutés après la première version : optionnels, pour relire sans
/// erreur ce qu'une ancienne version de l'app a écrit.
struct WidgetData: Codable {
    let day: String?
    let horseName: String
    let todaySessionTitle: String?
    let todaySessionDurationMin: Int?
    let todaySessionTime: String?
    let todaySessionDone: Bool?
    let weeklyDone: Int
    let weeklyTotal: Int
    let nextEventTitle: String?
    let nextEventDay: String?
    let nextEventTime: String?
    let alertsCount: Int?

    /// Aperçu de la galerie de widgets uniquement — jamais affiché à la place
    /// de vraies données (cf. `HorsetrackEntry.data == nil`).
    static let preview = WidgetData(
        day: dayString(Date()),
        horseName: "Éclair",
        todaySessionTitle: "Dressage",
        todaySessionDurationMin: 45,
        todaySessionTime: "18:00",
        todaySessionDone: false,
        weeklyDone: 2,
        weeklyTotal: 4,
        nextEventTitle: "Maréchal",
        nextEventDay: dayString(Calendar.current.date(byAdding: .day, value: 2, to: Date()) ?? Date()),
        nextEventTime: nil,
        alertsCount: 0
    )
}

private func dayString(_ date: Date) -> String {
    let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

private func parseDay(_ value: String?) -> Date? {
    guard let value else { return nil }
    let parts = value.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
}

/// « Aujourd'hui », « Demain », sinon « jeu. 30 oct. » — calculé à
/// l'affichage, jamais figé au moment où l'app a écrit les données.
private func whenLabel(day: String?, time: String?, now: Date) -> String? {
    guard let date = parseDay(day) else { return nil }
    let cal = Calendar.current
    var label: String
    if cal.isDate(date, inSameDayAs: now) {
        label = "Aujourd'hui"
    } else if let tomorrow = cal.date(byAdding: .day, value: 1, to: now), cal.isDate(date, inSameDayAs: tomorrow) {
        label = "Demain"
    } else {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.setLocalizedDateFormatFromTemplate("EEEdMMM")
        label = f.string(from: date)
    }
    if let time, !time.isEmpty { label += " · \(time)" }
    return label
}

// MARK: - Timeline

struct HorsetrackEntry: TimelineEntry {
    let date: Date
    /// nil tant que l'app n'a jamais écrit : on invite alors à l'ouvrir.
    let data: WidgetData?

    /// Les données décrivent-elles bien le jour affiché ? Après minuit, sans
    /// réouverture de l'app, la séance « du jour » serait celle de la veille.
    var isCurrentDay: Bool {
        guard let data, let day = parseDay(data.day) else { return false }
        return Calendar.current.isDate(day, inSameDayAs: date)
    }

    /// Prochain événement encore à venir à la date affichée.
    var nextEventLabel: String? {
        guard let data, let title = data.nextEventTitle, let day = parseDay(data.nextEventDay) else { return nil }
        guard day >= Calendar.current.startOfDay(for: date) else { return nil }
        guard let when = whenLabel(day: data.nextEventDay, time: data.nextEventTime, now: date) else { return nil }
        return "\(title) · \(when)"
    }
}

struct HorsetrackProvider: TimelineProvider {
    func placeholder(in context: Context) -> HorsetrackEntry {
        HorsetrackEntry(date: .now, data: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (HorsetrackEntry) -> Void) {
        // Galerie de widgets : un aperçu parlant si l'app n'a encore rien écrit.
        let data = load() ?? (context.isPreview ? .preview : nil)
        completion(HorsetrackEntry(date: .now, data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HorsetrackEntry>) -> Void) {
        let data = load()
        let now = Date()
        // Une entrée maintenant, une autre à minuit : le libellé « Demain »
        // devient « Aujourd'hui » et la séance de la veille disparaît, même si
        // l'app n'est pas rouverte. L'app redemande un rendu à chaque changement.
        let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now)
        let entries = [HorsetrackEntry(date: now, data: data), HorsetrackEntry(date: midnight, data: data)]
        completion(Timeline(entries: entries, policy: .after(midnight.addingTimeInterval(60))))
    }

    private func load() -> WidgetData? {
        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let json = defaults.string(forKey: widgetKey),
            let jsonData = json.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: jsonData)
    }
}

// MARK: - Éléments communs

private struct WeekProgress: View {
    let done: Int
    let total: Int

    private var progress: Double {
        guard total > 0 else { return 0 }
        return min(1, Double(done) / Double(total))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(.secondary.opacity(0.2)).frame(height: 4)
                    Capsule().fill(Color.accentColor).frame(width: geo.size.width * progress, height: 4)
                }
            }
            .frame(height: 4)
            Text(total > 0 ? "\(done)/\(total) séance\(total > 1 ? "s" : "") cette semaine" : "Aucune séance cette semaine")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

private struct TodayBlock: View {
    let entry: HorsetrackEntry
    let titleSize: CGFloat

    var body: some View {
        if let data = entry.data, entry.isCurrentDay, let title = data.todaySessionTitle {
            HStack(spacing: 4) {
                if data.todaySessionDone == true {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                }
                Text(title)
                    .font(.system(size: titleSize, weight: .bold))
                    .lineLimit(2)
                    .strikethrough(data.todaySessionDone == true, color: .secondary)
            }
            let details = [data.todaySessionTime, data.todaySessionDurationMin.map { "\($0) min" }]
                .compactMap { $0 }
                .joined(separator: " · ")
            if !details.isEmpty {
                Text(details).font(.system(size: 11)).foregroundStyle(.secondary)
            }
        } else {
            Text("Pas de séance prévue")
                .font(.system(size: titleSize - 1, weight: .semibold))
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
    }
}

private struct EmptyStateView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "figure.equestrian.sports")
                .font(.system(size: 22))
                .foregroundStyle(Color.accentColor)
            Text("Ouvre Horsetrack pour afficher ta journée")
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Petit widget

struct SmallView: View {
    let entry: HorsetrackEntry

    var body: some View {
        if let data = entry.data {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(data.horseName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    if let alerts = data.alertsCount, alerts > 0 {
                        Label("\(alerts)", systemImage: "exclamationmark.triangle.fill")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.orange)
                            .labelStyle(.titleAndIcon)
                    }
                }
                Spacer(minLength: 4)
                TodayBlock(entry: entry, titleSize: 14)
                Spacer(minLength: 6)
                WeekProgress(done: entry.isCurrentDay ? data.weeklyDone : 0, total: entry.isCurrentDay ? data.weeklyTotal : 0)
            }
        } else {
            EmptyStateView()
        }
    }
}

// MARK: - Widget moyen

struct MediumView: View {
    let entry: HorsetrackEntry

    var body: some View {
        if let data = entry.data {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("AUJOURD'HUI")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .kerning(0.5)
                    Text(data.horseName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    TodayBlock(entry: entry, titleSize: 15)
                    Spacer(minLength: 6)
                    WeekProgress(done: entry.isCurrentDay ? data.weeklyDone : 0, total: entry.isCurrentDay ? data.weeklyTotal : 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Rectangle().fill(.secondary.opacity(0.2)).frame(width: 1)

                VStack(alignment: .leading, spacing: 4) {
                    Text("ENSUITE")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .kerning(0.5)
                    if let next = entry.nextEventLabel {
                        Text(next)
                            .font(.system(size: 13, weight: .semibold))
                            .lineLimit(3)
                    } else {
                        Text("Rien de prévu")
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 4)
                    if let alerts = data.alertsCount, alerts > 0 {
                        Label("\(alerts) point\(alerts > 1 ? "s" : "") à surveiller", systemImage: "exclamationmark.triangle.fill")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.orange)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            EmptyStateView()
        }
    }
}

// MARK: - Choix de la vue selon la taille

struct HorsetrackWidgetEntryView: View {
    let entry: HorsetrackEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallView(entry: entry)
        default:
            MediumView(entry: entry)
        }
    }
}

// MARK: - Déclaration

@main
struct HorsetrackWidget: Widget {
    let kind = "HorsetrackWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HorsetrackProvider()) { entry in
            HorsetrackWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Horsetrack")
        .description("Ta séance du jour, ta semaine et ce qui arrive ensuite.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Aperçus Xcode

#Preview("Petit", as: .systemSmall) {
    HorsetrackWidget()
} timeline: {
    HorsetrackEntry(date: .now, data: .preview)
    HorsetrackEntry(date: .now, data: nil)
}

#Preview("Moyen", as: .systemMedium) {
    HorsetrackWidget()
} timeline: {
    HorsetrackEntry(date: .now, data: .preview)
    HorsetrackEntry(date: .now, data: nil)
}
