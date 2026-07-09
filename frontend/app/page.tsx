"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import JarvisBackground from "@/components/JarvisBackground";
import StatusBar from "@/components/StatusBar";
import ScanProgress from "@/components/ScanProgress";
import DossierCard from "@/components/DossierCard";
import { fetchProfile, proxyUrl, connectInstagram } from "@/lib/api";
import { loadModels, detectFaces, loadImageElement } from "@/lib/faceDetection";
import { scorePost } from "@/lib/scoring";
import type { ScoredPost } from "@/lib/scoring";

type AppState = "idle" | "fetching" | "loading-models" | "analyzing" | "complete" | "error";
type AuthState = "idle" | "connecting" | "connected";

const BOOT_LINES = [
  "INITIALIZING NEURAL INTERFACE...",
  "LOADING VISION SUBSYSTEMS...",
  "CALIBRATING BIOMETRIC SENSORS...",
  "ESTABLISHING SECURE CONNECTION...",
  "SYSTEM READY.",
];

const SESSION_KEY = "jarvis_ig_session";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [username, setUsername] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0, found: 0, status: "" });
  const [results, setResults] = useState<ScoredPost[]>([]);
  const [visibleResults, setVisibleResults] = useState(0);
  const abortRef = useRef(false);

  // Load saved session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      setSessionId(saved);
      setAuthState("connected");
    }
  }, []);

  // Boot animation
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setBootLines((prev) => [...prev, BOOT_LINES[i]]);
        i++;
      } else {
        clearInterval(id);
      }
    }, 280);
    return () => clearInterval(id);
  }, []);

  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 0.8;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const handleConnect = async () => {
    setAuthState("connecting");
    setError("");
    speak("Opening Instagram authentication.");
    try {
      const sid = await connectInstagram();
      setSessionId(sid);
      localStorage.setItem(SESSION_KEY, sid);
      setAuthState("connected");
      speak("Authentication successful. System ready.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Authentication failed");
      setAuthState("idle");
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId("");
    setAuthState("idle");
  };

  const handleScan = useCallback(async () => {
    const handle = username.trim().replace(/^@/, "");
    if (!handle || !sessionId) return;

    abortRef.current = false;
    setError("");
    setResults([]);
    setVisibleResults(0);

    setAppState("fetching");
    speak(`Initiating scan on ${handle}.`);

    let posts;
    try {
      const data = await fetchProfile(handle, sessionId);
      posts = data.posts;
      speak(`${posts.length} posts detected. Analyzing.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch profile";
      // Session may have expired
      if (msg.toLowerCase().includes("401") || msg.toLowerCase().includes("unauthorized")) {
        localStorage.removeItem(SESSION_KEY);
        setSessionId("");
        setAuthState("idle");
        setError("Session expired. Please reconnect Instagram.");
      } else {
        setError(msg);
      }
      setAppState("error");
      return;
    }

    setAppState("loading-models");
    setAnalyzeProgress({ current: 0, total: posts.length, found: 0, status: "LOADING VISION MODELS..." });

    try {
      await loadModels();
    } catch {
      setError("Failed to load face detection models. Run: npm run download-models");
      setAppState("error");
      return;
    }

    setAppState("analyzing");
    const scored: ScoredPost[] = [];
    const BATCH = 10;
    let completed = 0;

    for (let i = 0; i < posts.length; i += BATCH) {
      if (abortRef.current) break;

      const batch = posts.slice(i, i + BATCH);

      await Promise.all(
        batch.map(async (post) => {
          const proxied = proxyUrl(post.url);
          try {
            const img = await loadImageElement(proxied);
            const faceResult = await detectFaces(img);
            const sp = scorePost(post, faceResult, proxied);
            if (sp.subjectType !== "NONE") scored.push(sp);
          } catch {
            // Skip failed images silently
          } finally {
            completed++;
            setAnalyzeProgress({
              current: completed,
              total: posts.length,
              found: scored.length,
              status: `SCANNING POST ${completed} OF ${posts.length}...`,
            });
          }
        })
      );
    }

    const top10 = scored.sort((a, b) => b.score - a.score).slice(0, 10);
    setResults(top10);
    setAppState("complete");
    speak(`Analysis complete. ${top10.length} priority subjects identified.`);

    for (let i = 0; i <= top10.length; i++) {
      await new Promise((r) => setTimeout(r, 200));
      setVisibleResults(i);
    }
  }, [username, sessionId]);

  const handleReset = () => {
    abortRef.current = true;
    setAppState("idle");
    setResults([]);
    setVisibleResults(0);
    setError("");
    setBootLines([]);
    setTimeout(() => {
      let i = 0;
      const id = setInterval(() => {
        if (i < BOOT_LINES.length) {
          setBootLines((prev) => [...prev, BOOT_LINES[i]]);
          i++;
        } else clearInterval(id);
      }, 280);
    }, 100);
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <JarvisBackground />
      <StatusBar />

      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-8">

        {/* ── IDLE / ERROR STATE ── */}
        {(appState === "idle" || appState === "error") && (
          <div className="w-full max-w-2xl mx-auto mt-8 flex flex-col items-center gap-8">

            <div className="text-center space-y-2">
              <h1 className="text-5xl font-bold tracking-[0.4em] glow-cyan glitch-text" data-text="J.A.R.V.I.S">
                J.A.R.V.I.S
              </h1>
              <p className="text-jarvis-text opacity-50 text-sm tracking-widest">
                INSTAGRAM SUBJECT IDENTIFICATION SYSTEM
              </p>
            </div>

            {/* Boot log */}
            <div className="w-full border-glow rounded p-4 bg-jarvis-card/50 font-mono text-xs space-y-1 min-h-[120px]">
              {bootLines.map((line, i) => (
                <p key={i} className={i === bootLines.length - 1 ? "glow-cyan" : "text-jarvis-text opacity-60"}>
                  {i === bootLines.length - 1 ? "▶ " : "  "}{line}
                </p>
              ))}
              {bootLines.length === BOOT_LINES.length && (
                <p className="text-cyan-jarvis opacity-40 cursor">AWAITING INPUT</p>
              )}
            </div>

            {bootLines.length === BOOT_LINES.length && (
              <div className="w-full space-y-4 animate-fade-up">

                {/* ── Auth status / connect button ── */}
                {authState === "idle" && (
                  <button
                    onClick={handleConnect}
                    className="w-full py-4 text-sm tracking-[0.3em] font-bold rounded"
                    style={{
                      border: "1px solid rgba(255,107,53,0.5)",
                      color: "#FF6B35",
                      background: "rgba(255,107,53,0.05)",
                      cursor: "pointer",
                      fontFamily: "Space Mono, monospace",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,107,53,0.12)")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,107,53,0.05)")}
                  >
                    ◉ CONNECT INSTAGRAM
                  </button>
                )}

                {authState === "connecting" && (
                  <div
                    className="w-full py-4 text-sm tracking-[0.3em] font-bold rounded text-center animate-pulse"
                    style={{ border: "1px solid rgba(255,107,53,0.3)", color: "#FF6B35", fontFamily: "Space Mono, monospace" }}
                  >
                    ◌ AUTHENTICATING — LOG IN TO THE BROWSER WINDOW...
                  </div>
                )}

                {authState === "connected" && (
                  <div className="flex items-center justify-between px-4 py-3 rounded"
                    style={{ border: "1px solid rgba(0,212,255,0.3)", background: "rgba(0,212,255,0.04)" }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: "#00D4FF", display: "inline-block" }} />
                      <span className="text-cyan-jarvis text-xs tracking-widest font-mono">SESSION ACTIVE</span>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      className="text-xs tracking-widest opacity-40 hover:opacity-80 transition-opacity font-mono"
                      style={{ color: "#FF6B35" }}
                    >
                      DISCONNECT
                    </button>
                  </div>
                )}

                {/* ── Username input ── */}
                <div className="hud-corners p-1">
                  <div className="flex items-center">
                    <span className="px-4 py-3 text-cyan-jarvis opacity-50 text-sm font-mono border-r border-jarvis-border">
                      @
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleScan()}
                      placeholder="ENTER INSTAGRAM HANDLE"
                      className="jarvis-input flex-1 px-4 py-3 text-sm uppercase tracking-widest"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  onClick={handleScan}
                  disabled={!username.trim() || authState !== "connected"}
                  className="jarvis-btn w-full py-4 text-sm tracking-[0.4em] font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {authState !== "connected" ? "CONNECT INSTAGRAM FIRST" : "INITIATE SCAN"}
                </button>

                {error && (
                  <div className="border border-orange-jarvis/30 bg-orange-jarvis/5 rounded p-3 text-orange-jarvis text-xs text-center tracking-wider">
                    ⚠ {error}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 w-full text-center text-xs">
              {[
                { icon: "◎", label: "FACE PRIORITY", desc: "Close-up shots ranked highest" },
                { icon: "◫", label: "BODY COVERAGE", desc: "Half + full body scored" },
                { icon: "◈", label: "TOP 10", desc: "Only best subject photos shown" },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="border-glow rounded p-3 space-y-1">
                  <div className="glow-cyan text-lg">{icon}</div>
                  <div className="text-cyan-jarvis text-xs tracking-widest">{label}</div>
                  <div className="text-jarvis-text opacity-40 text-xs">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FETCHING STATE ── */}
        {appState === "fetching" && (
          <div className="flex flex-col items-center gap-6 mt-20">
            <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="4" />
              <circle
                cx="60" cy="60" r="50" fill="none" stroke="#00D4FF" strokeWidth="4"
                strokeDasharray="80 240" strokeLinecap="round"
                style={{ animation: "hudSpin 1.2s linear infinite", filter: "drop-shadow(0 0 6px #00D4FF)" }}
              />
            </svg>
            <p className="glow-cyan text-sm tracking-[0.3em] animate-pulse">ACCESSING INSTAGRAM DATABASE...</p>
            <p className="text-jarvis-text opacity-40 text-xs tracking-widest">TARGET: @{username.replace(/^@/, "")}</p>
          </div>
        )}

        {/* ── LOADING MODELS STATE ── */}
        {appState === "loading-models" && (
          <div className="flex flex-col items-center gap-4 mt-20">
            <p className="glow-cyan text-sm tracking-[0.3em] animate-pulse">LOADING NEURAL VISION MODELS...</p>
            <p className="text-jarvis-text opacity-40 text-xs">First run takes ~10 seconds</p>
          </div>
        )}

        {/* ── ANALYZING STATE ── */}
        {appState === "analyzing" && (
          <div className="w-full max-w-2xl mx-auto mt-12">
            <div className="text-center mb-8">
              <p className="text-xs tracking-[0.4em] text-jarvis-text opacity-50 mb-2">SUBJECT SCAN IN PROGRESS</p>
              <p className="text-jarvis-text opacity-30 text-xs">@{username.replace(/^@/, "")}</p>
            </div>
            <ScanProgress {...analyzeProgress} />
          </div>
        )}

        {/* ── COMPLETE STATE ── */}
        {appState === "complete" && (
          <div className="w-full max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="glow-cyan text-xl font-bold tracking-widest">SCAN COMPLETE</h2>
                <p className="text-jarvis-text opacity-50 text-xs mt-1 tracking-widest">
                  @{username.replace(/^@/, "")} — {results.length} PRIORITY SUBJECTS IDENTIFIED
                </p>
              </div>
              <button onClick={handleReset} className="jarvis-btn px-4 py-2 text-xs tracking-widest">
                NEW SCAN
              </button>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-20 text-jarvis-text opacity-40 tracking-widest">
                NO SUBJECTS IDENTIFIED IN RECENT POSTS
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {results.map((post, i) =>
                  i < visibleResults ? (
                    <DossierCard key={post.id} post={post} rank={i + 1} style={{ animationDelay: `${i * 80}ms` }} />
                  ) : null
                )}
              </div>
            )}

            {results.length > 0 && visibleResults >= results.length && (
              <div className="mt-8 border-glow rounded p-4 flex items-center justify-around text-xs animate-fade-up">
                {[
                  { label: "CLOSE-UP", value: results.filter((r) => r.subjectType === "FACE").length, color: "#00D4FF" },
                  { label: "HALF BODY", value: results.filter((r) => r.subjectType === "HALF_BODY").length, color: "#00FF88" },
                  { label: "FULL BODY", value: results.filter((r) => r.subjectType === "FULL_BODY").length, color: "#FF6B35" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <div className="text-2xl font-bold" style={{ color }}>{value}</div>
                    <div className="text-jarvis-text opacity-50 tracking-widest mt-1">{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
