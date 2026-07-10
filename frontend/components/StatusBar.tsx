"use client";

import { useEffect, useState } from "react";

export default function StatusBar() {
  const [time, setTime] = useState("");
  const [claudeStatus, setClaudeStatus] = useState<"unknown" | "online" | "offline">("unknown");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).replace(/\//g, ".") +
        " // " +
        now.toLocaleTimeString("en-US", { hour12: false })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("https://status.anthropic.com/api/v2/status.json");
        const data = await res.json();
        setClaudeStatus(data.status?.indicator === "none" ? "online" : "offline");
      } catch {
        setClaudeStatus("offline");
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="relative z-10 border-b border-jarvis-border bg-jarvis-bg/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-3 text-xs font-mono">
        {/* Left */}
        <div className="flex items-center gap-6">
          <span className="glow-cyan text-base font-bold tracking-[0.3em]">
            RYAN.AI
          </span>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full bg-cyan-jarvis pulse-dot"
              style={{ backgroundColor: "#00D4FF" }}
            />
            <span className="text-cyan-jarvis opacity-80">ONLINE</span>
          </div>
          <span className="text-jarvis-text opacity-50">v0.01</span>
        </div>

        {/* Center */}
        <div className="hidden md:flex items-center gap-8 text-jarvis-text opacity-60">
          <span>NEURAL: <span className="text-cyan-jarvis">98.2%</span></span>
          <span>VISION: <span className="text-cyan-jarvis">ACTIVE</span></span>
          <span>CLAUDE:{" "}
            <span style={{
              color: claudeStatus === "online" ? "#00D4FF" : claudeStatus === "offline" ? "#FF6B35" : "#666",
            }}>
              {claudeStatus === "online" ? "ONLINE" : claudeStatus === "offline" ? "OFFLINE" : "..."}
            </span>
          </span>
        </div>

        {/* Right */}
        <div className="text-jarvis-text opacity-50 tabular-nums">{time}</div>
      </div>

      {/* Animated bottom line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #00D4FF 20%, #00D4FF 80%, transparent 100%)",
          opacity: 0.3,
        }}
      />
    </header>
  );
}
