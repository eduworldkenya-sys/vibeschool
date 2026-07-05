"use client";

import { useEffect, useState } from "react";
import type { PulseSnapshot } from "@/lib/types";

interface WeatherState {
  temp: number;
  icon: string;
  desc: string;
}

const WEATHER_ICONS: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️", 61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "🌨️", 80: "🌦️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

const WEATHER_DESCS: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Foggy", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
  61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow",
  75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Thunderstorm",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

function useWeather() {
  const [weather, setWeather] = useState<WeatherState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather(lat: number, lon: number, city: string) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        const json = await res.json();
        const code = json.current_weather.weathercode;
        const temp = Math.round(json.current_weather.temperature);
        if (!cancelled) {
          setWeather({
            temp,
            icon: WEATHER_ICONS[code] ?? "🌡️",
            desc: `${city} · ${WEATHER_DESCS[code] ?? "Weather"}`,
          });
        }
      } catch {
        // Silently skip — weather is supplementary, never blocks the page.
      }
    }

    async function init() {
      const stored = typeof window !== "undefined" ? localStorage.getItem("wx_loc") : null;
      if (stored) {
        try {
          const s = JSON.parse(stored);
          await fetchWeather(s.lat, s.lon, s.city);
          return;
        } catch {
          // fall through to fresh lookup
        }
      }

      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const r = await fetch("https://ip-api.com/json/");
              const loc = await r.json();
              const city = loc.city ?? "My Location";
              const { latitude: lat, longitude: lon } = pos.coords;
              localStorage.setItem("wx_loc", JSON.stringify({ lat, lon, city }));
              await fetchWeather(lat, lon, city);
            } catch {
              await fetchWeather(pos.coords.latitude, pos.coords.longitude, "My Location");
            }
          },
          async () => {
            try {
              const r = await fetch("https://ip-api.com/json/");
              const loc = await r.json();
              await fetchWeather(loc.lat ?? -1.2921, loc.lon ?? 36.8219, loc.city ?? "Nairobi");
            } catch {
              await fetchWeather(-1.2921, 36.8219, "Nairobi");
            }
          }
        );
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return weather;
}

function StatPill({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        background: "rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: "10px 6px",
        textAlign: "center",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: 0.3 }}>
        {label}
      </div>
    </div>
  );
}

function headlineFor(
  snap: PulseSnapshot,
  focusSlot?: PulseSnapshot["todaySlots"][number]
): { tag: string; title: string } {
  if (focusSlot) {
    if (focusSlot.attendance_status === "completed") {
      return { tag: "LESSON TAUGHT", title: `${focusSlot.class_name} · ${focusSlot.subject}` };
    }
    return { tag: "TODAY'S LESSON", title: `${focusSlot.class_name} · ${focusSlot.subject}` };
  }
  const total = snap.todaySlots.length;
  if (total === 0) {
    return { tag: "FREE DAY", title: "No lessons scheduled today" };
  }
  const markedCount = snap.todaySlots.filter((s) => s.attendance_status === "completed").length;
  if (markedCount === total) {
    return { tag: "DAY COMPLETE", title: "All lessons taught today" };
  }
  return { tag: "TODAY'S LESSONS", title: `${total - markedCount} of ${total} lessons remaining` };
}

export default function TodayHero({
  snap,
  focusSlot,
  focusRoster,
  onOpenTimetable,
  onOpenStudents,
  onOpenAttendance,
}: {
  snap: PulseSnapshot;
  focusSlot?: PulseSnapshot["todaySlots"][number];
  focusRoster?: PulseSnapshot["myClasses"][number];
  onOpenTimetable?: () => void;
  onOpenStudents?: () => void;
  onOpenAttendance?: () => void;
}) {
  const weather = useWeather();
  const { tag, title } = headlineFor(snap, focusSlot);
  const markedCount = snap.todaySlots.filter((s) => s.attendance_status === "completed").length;
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const lessonsValue = focusSlot ? 1 : snap.todaySlots.length;
  const studentsValue = focusSlot && focusRoster ? focusRoster.studentCount : snap.totalStudentsToday;
  const attendanceValue = focusSlot
    ? focusSlot.attendance_status === "completed"
      ? "Marked"
      : "Not marked"
    : snap.todaySlots.length > 0
    ? `${markedCount}/${snap.todaySlots.length}`
    : "—";
  const pendingValue = focusSlot
    ? snap.attPending.some((p) => p.class_id === focusSlot.class_id)
      ? 1
      : 0
    : snap.attPending.length;

  return (
    <div
      style={{
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 60%, #065f46 100%)",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{dateStr}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
          {weather ? (
            <>
              <span>{weather.icon}</span>
              <span>{weather.temp}°</span>
            </>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.4)" }}>🌡️ --°</span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: "#6ee7b7", letterSpacing: 0.6, marginTop: 12 }}>
        {tag}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>{title}</div>
      {weather && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{weather.desc}</div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <StatPill label="LESSONS" value={lessonsValue} onClick={onOpenTimetable} />
        <StatPill label="STUDENTS" value={studentsValue} onClick={onOpenStudents} />
        <StatPill label="ATTENDANCE" value={attendanceValue} onClick={onOpenAttendance} />
        <StatPill label="PENDING" value={pendingValue} onClick={onOpenAttendance} />
      </div>
    </div>
  );
}
