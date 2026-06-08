import WidgetKit
import SwiftUI
import AppIntents

// MARK: - App Intent

struct AddWaterIntent: AppIntent {
    static var title: LocalizedStringResource = "Wasser hinzufügen"
    static var description = IntentDescription("Fügt Wasser zum Tagesziel hinzu.")

    @Parameter(title: "Menge in ml")
    var amountMl: Int

    init() { self.amountMl = 250 }
    init(amountMl: Int) { self.amountMl = amountMl }

    func perform() async throws -> some IntentResult {
        let appGroup = "group.com.kombat.app"
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            return .result()
        }
        let current = defaults.integer(forKey: "water_amount_ml")
        let goal    = defaults.integer(forKey: "water_goal_ml")
        let goalMl  = goal > 0 ? goal : 3000
        let newAmount = min(current + amountMl, goalMl)

        defaults.set(newAmount, forKey: "water_amount_ml")

        // Track how much was added while app was closed, so the app can sync to Supabase
        let existing = defaults.integer(forKey: "water_pending_sync_ml")
        defaults.set(existing + amountMl, forKey: "water_pending_sync_ml")

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - Data model

struct WaterEntry: TimelineEntry {
    let date: Date
    let amountMl: Int
    let goalMl: Int

    var progress: Double {
        guard goalMl > 0 else { return 0 }
        return min(Double(amountMl) / Double(goalMl), 1.0)
    }

    var amountFormatted: String {
        String(format: "%.2f", Double(amountMl) / 1000).replacingOccurrences(of: ".", with: ",") + "L"
    }

    var goalFormatted: String {
        String(format: "%.2f", Double(goalMl) / 1000).replacingOccurrences(of: ".", with: ",") + "L"
    }
}

// MARK: - Provider

struct WaterProvider: TimelineProvider {
    private let appGroup = "group.com.kombat.app"

    func placeholder(in context: Context) -> WaterEntry {
        WaterEntry(date: Date(), amountMl: 1800, goalMl: 3000)
    }

    func getSnapshot(in context: Context, completion: @escaping (WaterEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WaterEntry>) -> Void) {
        let entry = loadEntry()
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextRefresh))
        completion(timeline)
    }

    private func loadEntry() -> WaterEntry {
        let defaults = UserDefaults(suiteName: appGroup)
        let amount = defaults?.integer(forKey: "water_amount_ml") ?? 0
        let goal   = defaults?.integer(forKey: "water_goal_ml")   ?? 3000
        return WaterEntry(date: Date(), amountMl: amount, goalMl: goal)
    }
}

// MARK: - Bottle illustration

struct ThermosBottleView: View {
    var progress: Double

    var body: some View {
        GeometryReader { geo in
            let w      = geo.size.width
            let h      = geo.size.height
            let bodyH  = h * 0.76
            let capH   = h * 0.09
            let neckH  = h * 0.05
            let shoulH = h * 0.07
            let stackH = capH + neckH + shoulH + bodyH

            let topPad = (h - stackH) / 2

            VStack(spacing: 0) {
                Spacer().frame(height: topPad)

                // Screw cap
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.label))
                    .frame(width: w * 0.52, height: capH)

                // Neck connector
                Rectangle()
                    .fill(Color(.label))
                    .frame(width: w * 0.40, height: neckH)

                // Shoulder
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color(.label).opacity(0.72))
                    .frame(width: w * 0.78, height: shoulH)

                // Body
                ZStack(alignment: .bottom) {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(Color(.systemBackground))
                        .overlay(
                            RoundedRectangle(cornerRadius: 7)
                                .stroke(Color(.systemGray4), lineWidth: 0.75)
                        )

                    if progress > 0 {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color(red: 0.29, green: 0.56, blue: 0.85))
                            .frame(height: bodyH * CGFloat(progress))
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                    }

                    HStack {
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(Color.white.opacity(0.22))
                            .frame(width: 3, height: bodyH * 0.44)
                            .padding(.leading, w * 0.18)
                            .padding(.bottom, bodyH * 0.28)
                        Spacer()
                    }

                    RoundedRectangle(cornerRadius: 7)
                        .fill(Color(.systemGray5))
                        .frame(height: 4)
                        .padding(.horizontal, 2)
                }
                .frame(width: w, height: bodyH)

                Spacer()
            }
        }
    }
}

// MARK: - Small widget view

struct WaterWidgetSmallView: View {
    var entry: WaterEntry

    var body: some View {
        VStack(spacing: 6) {
            ThermosBottleView(progress: entry.progress)
                .frame(width: 38, height: 76)

            Text(entry.amountFormatted)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.primary)

            Text("\(Int(entry.progress * 100))%")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
        }
        .padding(12)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Medium widget view

struct WaterWidgetMediumView: View {
    var entry: WaterEntry

    var body: some View {
        HStack(spacing: 16) {
            ThermosBottleView(progress: entry.progress)
                .frame(width: 40, height: 88)

            VStack(alignment: .leading, spacing: 5) {
                Text("Wasser")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.secondary)
                    .textCase(.none)

                Text(entry.amountFormatted)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(.primary)

                Text("von \(entry.goalFormatted)")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color(.systemGray5))
                            .frame(height: 3)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color(red: 0.29, green: 0.56, blue: 0.85))
                            .frame(
                                width: geo.size.width * CGFloat(entry.progress),
                                height: 3
                            )
                    }
                }
                .frame(height: 3)

                // Button row — only visible in medium widget
                HStack(spacing: 8) {
                    Button(intent: AddWaterIntent(amountMl: 250)) {
                        Text("+250 ml")
                            .font(.system(size: 12, weight: .medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color(red: 0.29, green: 0.56, blue: 0.85).opacity(0.15))
                            )
                            .foregroundColor(Color(red: 0.29, green: 0.56, blue: 0.85))
                    }
                    .buttonStyle(.plain)

                    Button(intent: AddWaterIntent(amountMl: 500)) {
                        Text("+500 ml")
                            .font(.system(size: 12, weight: .medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color(red: 0.29, green: 0.56, blue: 0.85).opacity(0.15))
                            )
                            .foregroundColor(Color(red: 0.29, green: 0.56, blue: 0.85))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 2)

                if entry.amountMl >= entry.goalMl {
                    Text("Tagesziel erreicht")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Color(red: 0.29, green: 0.56, blue: 0.85))
                }
            }
        }
        .padding(16)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Entry view (family router)

struct WaterWidgetEntryView: View {
    var entry: WaterEntry
    @Environment(\.widgetFamily) var widgetFamily

    var body: some View {
        switch widgetFamily {
        case .systemSmall:
            WaterWidgetSmallView(entry: entry)
        default:
            WaterWidgetMediumView(entry: entry)
        }
    }
}

// MARK: - Widget + Bundle

struct WaterWidget: Widget {
    let kind: String = "WaterWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WaterProvider()) { entry in
            WaterWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Wassertracking")
        .description("Zeigt deinen täglichen Wasserstand.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct WaterWidgetBundle: WidgetBundle {
    var body: some Widget {
        WaterWidget()
    }
}
