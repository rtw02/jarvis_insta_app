"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import WeatherWidget from "./WeatherWidget";
import CalendarWidget from "./CalendarWidget";
import CommuteWidget from "./CommuteWidget";
import BirthdayWidget from "./BirthdayWidget";
import HoloPanel from "./HoloPanel";
import {
  loadGoogleScript, requestGoogleToken, fetchUserInfo,
  fetchTodayEvents, fetchRecentEvents,
  saveToken, loadToken, clearToken,
} from "@/lib/google";
import {
  extractFriendsFromEvents, loadFriends, saveFriends, mergeFriends,
} from "@/lib/friends";
import type { CalendarEvent, GoogleUser } from "@/lib/google";
import type { Friend } from "@/lib/friends";

type AuthState = "idle" | "loading" | "authed" | "error";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

function timeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function BriefingTab({ onOpenScanner }: { onOpenScanner?: () => void }) {
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState("");
  const [calDebug, setCalDebug] = useState("");
  const [authError, setAuthError] = useState("");
  const tokenRef = useRef<string>("");

  const greeting = `Good ${timeOfDay()}, Ryan. Here's your daily overview.`;

  const loadCalendarData = useCallback(async (token: string, userEmail: string) => {
    setCalLoading(true);
    setCalError("");
    setCalDebug("");
    try {
      // Fetch calendar list first so we can show debug info
      const calListRes = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!calListRes.ok) {
        const errText = await calListRes.text();
        setCalError(`Calendar list failed (${calListRes.status}): ${errText.slice(0, 120)}`);
        setCalLoading(false);
        return;
      }
      const calListData = await calListRes.json();
      const calIds: string[] = (calListData.items ?? []).map((c: { id: string; summary: string }) => c.id);
      setCalDebug(`${calIds.length} calendars found`);
      console.log("[CAL] Calendars:", calListData.items?.map((c: { id: string; summary: string }) => `${c.summary} (${c.id})`));

      const [todayEvts, recentEvts] = await Promise.all([
        fetchTodayEvents(token),
        fetchRecentEvents(token, 90),
      ]);
      console.log("[CAL] Today events:", todayEvts.length, todayEvts.map(e => e.summary));
      setEvents(todayEvts);
      if (todayEvts.length === 0) setCalDebug(d => d + " · 0 events today");

      const extracted = extractFriendsFromEvents(recentEvts, userEmail);
      const existing = loadFriends();
      const merged = mergeFriends(existing, extracted);
      saveFriends(merged);
      setFriends(merged);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Calendar load error:", e);
      setCalError(msg);
    } finally {
      setCalLoading(false);
    }
  }, []);

  // On mount: check for existing token
  useEffect(() => {
    const saved = loadToken();
    if (saved) {
      tokenRef.current = saved;
      setAuthState("authed");
      // Load user info
      fetchUserInfo(saved)
        .then(u => {
          setUser(u);
          return loadCalendarData(saved, u.email);
        })
        .catch(() => {
          clearToken();
          setAuthState("idle");
        });
    } else {
      setFriends(loadFriends());
    }
  }, [loadCalendarData]);

  async function handleAuth() {
    if (!CLIENT_ID) {
      setAuthError("NEXT_PUBLIC_GOOGLE_CLIENT_ID not set in .env.local");
      return;
    }
    setAuthState("loading");
    setAuthError("");
    try {
      await loadGoogleScript();
      const token = await requestGoogleToken(CLIENT_ID);
      saveToken(token);
      tokenRef.current = token;
      const u = await fetchUserInfo(token);
      setUser(u);
      setAuthState("authed");
      await loadCalendarData(token, u.email);
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : "Auth failed");
      setAuthState("error");
    }
  }

  function handleDisconnect() {
    clearToken();
    setUser(null);
    setEvents([]);
    setFriends([]);
    setAuthState("idle");
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6" style={{ transformStyle: "preserve-3d" }}>

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-[0.3em] glow-cyan" style={{ fontFamily: "Space Mono, monospace" }}>
            RYAN.AI
          </h1>
          <p className="text-jarvis-text opacity-40 text-xs tracking-widest mt-1 font-mono">
            {dateStr.toUpperCase()} · {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>

        {authState === "idle" || authState === "error" ? (
          <div className="text-right space-y-2">
            <button onClick={handleAuth}
              className="px-5 py-2.5 text-xs tracking-[0.25em] font-bold font-mono rounded transition-all"
              style={{
                border: "1px solid rgba(0,212,255,0.5)",
                color: "#00D4FF",
                background: "rgba(0,212,255,0.05)",
              }}>
              ◉ CONNECT GOOGLE
            </button>
            {authError && (
              <div className="text-xs font-mono" style={{ color: "#FF6B35" }}>{authError}</div>
            )}
          </div>
        ) : authState === "loading" ? (
          <div className="text-xs font-mono text-cyan-jarvis animate-pulse tracking-widest">AUTHENTICATING...</div>
        ) : (
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2 justify-end">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#00D4FF", boxShadow: "0 0 4px #00D4FF" }} />
              <span className="text-xs font-mono text-cyan-jarvis tracking-widest">GOOGLE LINKED</span>
            </div>
            {user && <div className="text-jarvis-text opacity-40 text-xs font-mono">{user.email}</div>}
            <button onClick={handleDisconnect}
              className="text-xs font-mono opacity-30 hover:opacity-60 transition-opacity tracking-widest"
              style={{ color: "#FF6B35" }}>
              DISCONNECT
            </button>
          </div>
        )}
      </div>

      {/* Daily greeting — closest to viewer */}
      <HoloPanel delay={0.1} z={30} bobPhase={0} className="p-5" style={{ borderColor: "rgba(0,212,255,0.3)" }}>
        <div className="flex items-start justify-between">
          <div className="text-cyan-jarvis opacity-40 text-xs tracking-widest font-mono mb-3">// DAILY BRIEFING</div>
          {onOpenScanner && (
            <button onClick={onOpenScanner}
              className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded transition-opacity opacity-20 hover:opacity-50"
              style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)" }}>
              INSTA SCANNER
            </button>
          )}
        </div>
        <p className="text-sm font-mono leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
          {greeting}
        </p>
      </HoloPanel>

      {/* Two-widget row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ transformStyle: "preserve-3d" }}>
        <HoloPanel delay={0.2} z={22} bobPhase={1}><WeatherWidget /></HoloPanel>
        <HoloPanel delay={0.3} z={18} bobPhase={2}><CalendarWidget events={events} loading={calLoading} /></HoloPanel>
      </div>

      {/* Commute times for events with locations */}
      <HoloPanel delay={0.4} z={12} bobPhase={3}><CommuteWidget events={events} /></HoloPanel>

      {/* Upcoming birthdays — furthest back */}
      <HoloPanel delay={0.5} z={6} bobPhase={4}><BirthdayWidget /></HoloPanel>

      {/* Debug / error row */}
      {(calError || calDebug) && (
        <div className="text-xs font-mono px-1 space-y-1">
          {calError && <div style={{ color: "#FF6B35" }}>⚠ {calError}</div>}
          {calDebug && !calError && <div className="text-jarvis-text opacity-30">{calDebug}</div>}
        </div>
      )}

      {/* Sync status */}
      {authState === "authed" && !calLoading && (
        <div className="text-center">
          <button
            onClick={() => user && loadCalendarData(tokenRef.current, user.email)}
            className="text-xs font-mono opacity-20 hover:opacity-50 transition-opacity tracking-widest"
            style={{ color: "#00D4FF" }}>
            ↻ REFRESH DATA
          </button>
        </div>
      )}
    </div>
  );
}
