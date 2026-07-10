"use client";

import type { CalendarEvent } from "@/lib/google";

interface Props {
  events: CalendarEvent[];
  loading: boolean;
}

function formatTime(event: CalendarEvent): string {
  const dt = event.start?.dateTime;
  if (!dt) return "ALL DAY";
  const d = new Date(dt);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${m} ${period}`;
}

function formatDuration(event: CalendarEvent): string {
  const start = event.start?.dateTime;
  const end = event.end?.dateTime;
  if (!start || !end) return "";
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isNow(event: CalendarEvent): boolean {
  const start = event.start?.dateTime;
  const end = event.end?.dateTime;
  if (!start || !end) return false;
  const now = Date.now();
  return now >= new Date(start).getTime() && now <= new Date(end).getTime();
}

export default function CalendarWidget({ events, loading }: Props) {
  return (
    <div className="border-glow rounded-lg p-4 h-full" style={{ background: "rgba(0,212,255,0.02)" }}>
      <div className="text-cyan-jarvis opacity-40 text-xs tracking-widest font-mono mb-3">// TODAY&apos;S SCHEDULE</div>

      {loading && (
        <div className="text-xs text-jarvis-text opacity-40 animate-pulse tracking-widest">ACCESSING CALENDAR...</div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-xs text-jarvis-text opacity-30 tracking-widest">NO EVENTS SCHEDULED</div>
      )}

      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "280px" }}>
        {events.map((event) => {
          const active = isNow(event);
          return (
            <div key={event.id}
              className="flex gap-3 items-start rounded p-2 transition-all"
              style={{
                background: active ? "rgba(0,212,255,0.06)" : "transparent",
                border: active ? "1px solid rgba(0,212,255,0.2)" : "1px solid transparent",
              }}
            >
              <div className="flex-shrink-0 text-right" style={{ minWidth: "60px" }}>
                <div className="text-xs font-mono font-bold" style={{ color: active ? "#00D4FF" : "rgba(255,255,255,0.5)" }}>
                  {formatTime(event)}
                </div>
                {formatDuration(event) && (
                  <div className="text-jarvis-text opacity-30" style={{ fontSize: "10px" }}>
                    {formatDuration(event)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "#00D4FF", boxShadow: "0 0 4px #00D4FF" }} />
                  )}
                  <div className="text-xs font-mono truncate"
                    style={{ color: active ? "#fff" : "rgba(255,255,255,0.7)" }}>
                    {event.summary ?? "Untitled"}
                  </div>
                </div>
                {event.attendees && event.attendees.filter(a => !a.self).length > 0 && (
                  <div className="text-jarvis-text opacity-30 mt-0.5 truncate" style={{ fontSize: "10px" }}>
                    {event.attendees.filter(a => !a.self).map(a => a.displayName ?? a.email.split("@")[0]).slice(0, 3).join(", ")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
