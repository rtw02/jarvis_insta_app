"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
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

// ── D3 horizontal timeline ────────────────────────────────────────────────────

function D3Timeline({ events }: { events: CalendarEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl) return;

    const W = container.clientWidth || 320;
    const H = 72;
    const ML = 30, MR = 8, MT = 10, MB = 22;

    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(7, 0, 0, 0);
    const dayEnd   = new Date(now); dayEnd.setHours(22, 0, 0, 0);

    const x = d3.scaleTime().domain([dayStart, dayEnd]).range([ML, W - MR]);

    const svg = d3.select(svgEl).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    // Defs: glow filter + clipping rect
    const defs = svg.append("defs");
    defs.append("filter").attr("id", "tl-glow")
      .attr("x", "-30%").attr("y", "-30%").attr("width", "160%").attr("height", "160%")
      .append("feGaussianBlur").attr("stdDeviation", "2").attr("result", "b")
      .select(function(this: SVGElement) { return (this.parentNode as SVGElement)!; })
      .append("feMerge").selectAll("feMergeNode").data(["b", "SourceGraphic"])
      .enter().append("feMergeNode").attr("in", (d: string) => d);

    defs.append("clipPath").attr("id", "tl-clip")
      .append("rect").attr("x", ML).attr("y", MT - 2)
      .attr("width", W - ML - MR).attr("height", H - MT - MB + 4);

    // Hour tick lines (every 2 hours)
    const hours = d3.timeHours(dayStart, dayEnd, 2);
    svg.selectAll(".htick")
      .data(hours).enter().append("line")
      .attr("x1", (d: Date) => x(d)).attr("x2", (d: Date) => x(d))
      .attr("y1", MT).attr("y2", H - MB + 4)
      .attr("stroke", "rgba(0,212,255,0.07)").attr("stroke-width", 1);

    // Hour labels
    svg.selectAll(".hlabel")
      .data(hours).enter().append("text")
      .attr("x", (d: Date) => x(d))
      .attr("y", H - 5)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(0,212,255,0.25)")
      .attr("font-family", "Space Mono, monospace")
      .attr("font-size", "8px")
      .text((d: Date) => {
        const h = d.getHours();
        return h === 12 ? "12P" : h > 12 ? `${h - 12}P` : `${h}A`;
      });

    // Baseline
    svg.append("line")
      .attr("x1", ML).attr("x2", W - MR)
      .attr("y1", H - MB + 4).attr("y2", H - MB + 4)
      .attr("stroke", "rgba(0,212,255,0.1)").attr("stroke-width", 0.5);

    // Events
    const BAR_H = 22, BAR_Y = MT + (H - MT - MB - BAR_H) / 2;

    events.forEach(event => {
      const startDt = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      const endDt   = event.end?.dateTime   ? new Date(event.end.dateTime)   : null;
      if (!startDt || !endDt) return;

      const active = isNow(event);
      const bx1 = Math.max(ML, x(startDt));
      const bx2 = Math.min(W - MR, x(endDt));
      if (bx2 <= bx1 + 1) return;

      const barW = bx2 - bx1;
      const g = svg.append("g").attr("clip-path", "url(#tl-clip)");

      // 3D extrusion shadow underneath bar
      g.append("rect")
        .attr("x", bx1 + 2).attr("y", BAR_Y + 4)
        .attr("width", barW).attr("height", BAR_H)
        .attr("rx", 3)
        .attr("fill", active ? "rgba(0,212,255,0.12)" : "rgba(0,212,255,0.04)");

      // Main bar
      g.append("rect")
        .attr("x", bx1).attr("y", BAR_Y)
        .attr("width", barW).attr("height", BAR_H)
        .attr("rx", 3)
        .attr("fill", active ? "rgba(0,212,255,0.18)" : "rgba(0,212,255,0.07)")
        .attr("stroke", active ? "rgba(0,212,255,0.75)" : "rgba(0,212,255,0.22)")
        .attr("stroke-width", active ? 1 : 0.5);

      // Top highlight edge (faux 3D lighting)
      g.append("rect")
        .attr("x", bx1 + 1).attr("y", BAR_Y)
        .attr("width", barW - 2).attr("height", 1)
        .attr("fill", active ? "rgba(0,212,255,0.6)" : "rgba(0,212,255,0.2)");

      // Active indicator: bright left edge + glow
      if (active) {
        g.append("rect")
          .attr("x", bx1).attr("y", BAR_Y)
          .attr("width", 2).attr("height", BAR_H).attr("rx", 1)
          .attr("fill", "#00D4FF").attr("filter", "url(#tl-glow)");
      }

      // Label (truncate to fit)
      if (barW > 18) {
        const maxChars = Math.floor(barW / 5.5);
        const label = (event.summary ?? "Untitled").slice(0, maxChars);
        g.append("text")
          .attr("x", bx1 + 5).attr("y", BAR_Y + BAR_H / 2 + 3)
          .attr("fill", active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)")
          .attr("font-family", "Space Mono, monospace")
          .attr("font-size", "7.5px")
          .text(label + (label.length < (event.summary ?? "").length ? "…" : ""));
      }
    });

    // Current time indicator
    if (now > dayStart && now < dayEnd) {
      const nx = x(now);
      // Glow vertical beam
      svg.append("line")
        .attr("x1", nx).attr("x2", nx)
        .attr("y1", MT - 6).attr("y2", H - MB + 6)
        .attr("stroke", "#00D4FF").attr("stroke-width", 1)
        .attr("opacity", 0.85).attr("filter", "url(#tl-glow)");
      // Triangle indicator at top
      svg.append("polygon")
        .attr("points", `${nx - 4},${MT - 6} ${nx + 4},${MT - 6} ${nx},${MT}`)
        .attr("fill", "#00D4FF").attr("filter", "url(#tl-glow)");
    }

  }, [events]);

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function CalendarWidget({ events, loading }: Props) {
  return (
    <div className="border-glow rounded-lg p-4 h-full" style={{ background: "rgba(0,212,255,0.02)" }}>
      <div className="text-cyan-jarvis opacity-40 text-xs tracking-widest font-mono mb-2">// TODAY&apos;S SCHEDULE</div>

      {loading && (
        <div className="text-xs text-jarvis-text opacity-40 animate-pulse tracking-widest font-mono">ACCESSING CALENDAR...</div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-xs text-jarvis-text opacity-30 tracking-widest font-mono">NO EVENTS SCHEDULED</div>
      )}

      {/* D3 timeline */}
      {!loading && events.length > 0 && (
        <div className="mb-3">
          <D3Timeline events={events} />
        </div>
      )}

      {/* Event list */}
      <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: "200px" }}>
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
                    {event.attendees.filter(a => !a.self)
                      .map(a => a.displayName ?? a.email.split("@")[0])
                      .slice(0, 3).join(", ")}
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
