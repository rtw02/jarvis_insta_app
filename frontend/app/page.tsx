"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import JarvisBackground from "@/components/JarvisBackground";
import StatusBar from "@/components/StatusBar";
import ScanProgress from "@/components/ScanProgress";
import DossierCard from "@/components/DossierCard";
import SubjectProfile from "@/components/SubjectProfile";
import ScanLoader from "@/components/ScanLoader";
import { fetchProfile, proxyUrl, connectInstagram } from "@/lib/api";
import { loadModels, detectFaces, loadImageElement } from "@/lib/faceDetection";
import { scorePost } from "@/lib/scoring";
import { clusterFaces, findMainSubject, getMainSubjectPostIndices } from "@/lib/clustering";
import type { ScoredPost } from "@/lib/scoring";
import type { FaceResult } from "@/lib/faceDetection";
import type { RawPost } from "@/lib/api";

type AppState = "idle" | "fetching" | "loading-models" | "analyzing" | "clustering" | "complete" | "error";
type AuthState = "idle" | "connecting" | "connected";

interface PostAnalysis {
  post: RawPost;
  faceResult: FaceResult;
  proxiedUrl: string;
}

interface SubjectInfo {
  appearances: number;
  totalScanned: number;
  bestPhotoUrl: string;
}

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
  const [clusterStatus, setClusterStatus] = useState("");
  const [results, setResults] = useState<ScoredPost[]>([]);
  const [visibleResults, setVisibleResults] = useState(0);
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) { setSessionId(saved); setAuthState("connected"); }
  }, []);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i < BOOT_LINES.length) { setBootLines((prev) => [...prev, BOOT_LINES[i]]); i++; }
      else clearInterval(id);
    }, 280);
    return () => clearInterval(id);
  }, []);

  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; u.pitch = 0.8;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const handleConnect = async () => {
    setAuthState("connecting"); setError("");
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
    setSessionId(""); setAuthState("idle");
  };

  const handleScan = useCallback(async () => {
    const handle = username.trim().replace(/^@/, "");
    if (!handle || !sessionId) return;

    abortRef.current = false;
    setError(""); setResults([]); setVisibleResults(0); setSubjectInfo(null);

    // ── Phase 1: Fetch posts ──
    setAppState("fetching");
    speak(`Initiating scan on ${handle}.`);

    let posts;
    try {
      const data = await fetchProfile(handle, sessionId);
      posts = data.posts;
      speak(`${posts.length} posts detected. Analyzing.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch profile";
      if (msg.toLowerCase().includes("401") || msg.toLowerCase().includes("unauthorized")) {
        localStorage.removeItem(SESSION_KEY); setSessionId(""); setAuthState("idle");
        setError("Session expired. Please reconnect Instagram.");
      } else {
        setError(msg);
      }
      setAppState("error"); return;
    }

    // ── Phase 2: Load models ──
    setAppState("loading-models");
    setAnalyzeProgress({ current: 0, total: posts.length, found: 0, status: "LOADING VISION MODELS..." });
    try {
      await loadModels();
    } catch {
      setError("Failed to load face detection models. Run: npm run download-models");
      setAppState("error"); return;
    }

    // ── Phase 3: Detect faces + extract descriptors ──
    setAppState("analyzing");
    const analyses: PostAnalysis[] = [];
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
            analyses.push({ post, faceResult, proxiedUrl: proxied });
          } catch {
            analyses.push({ post, faceResult: { faceCount: 0, maxFaceAreaPct: 0, descriptors: [] }, proxiedUrl: proxied });
          }
        })
      );

      // Update progress once per batch — after await, React guaranteed to render this
      completed = Math.min(i + BATCH, posts.length);
      setAnalyzeProgress({
        current: completed,
        total: posts.length,
        found: analyses.filter(a => a.faceResult.faceCount > 0).length,
        status: `SCANNED ${completed} OF ${posts.length} POSTS...`,
      });
    }

    // ── Phase 4: Cluster faces → identify main subject ──
    setAppState("clustering");
    setClusterStatus("BUILDING BIOMETRIC CLUSTERS...");
    speak("Identifying primary subject.");

    await new Promise(r => setTimeout(r, 100)); // yield to render

    // Build descriptor entries
    const entries: { descriptor: Float32Array; postIndex: number }[] = [];
    analyses.forEach((a, idx) => {
      for (const d of a.faceResult.descriptors) {
        entries.push({ descriptor: d, postIndex: idx });
      }
    });

    const clusters = clusterFaces(entries);
    const mainCluster = findMainSubject(clusters);

    let filteredAnalyses: PostAnalysis[];
    let bestPhotoUrl = "";

    if (mainCluster && new Set(mainCluster.postIndices).size >= 2) {
      // Found a clear main subject
      const mainIndices = getMainSubjectPostIndices(mainCluster);
      filteredAnalyses = analyses.filter((_, i) => mainIndices.has(i) && analyses[i].faceResult.faceCount > 0);

      // Best photo = highest face coverage from main cluster posts
      const bestAnalysis = filteredAnalyses.reduce((best, a) =>
        a.faceResult.maxFaceAreaPct > best.faceResult.maxFaceAreaPct ? a : best
      );
      bestPhotoUrl = bestAnalysis.proxiedUrl;

      setSubjectInfo({
        appearances: new Set(mainCluster.postIndices).size,
        totalScanned: analyses.length,
        bestPhotoUrl,
      });

      setClusterStatus(`PRIMARY SUBJECT IDENTIFIED — ${new Set(mainCluster.postIndices).size} APPEARANCES ACROSS ${clusters.length} UNIQUE FACES`);
      speak(`Primary subject identified. ${new Set(mainCluster.postIndices).size} appearances detected.`);
    } else {
      // No dominant subject — fall back to all posts with faces
      filteredAnalyses = analyses.filter(a => a.faceResult.faceCount > 0);
      setClusterStatus("NO DOMINANT SUBJECT FOUND — SHOWING ALL DETECTED SUBJECTS");
    }

    await new Promise(r => setTimeout(r, 800)); // show cluster status briefly

    // ── Phase 5: Score + rank top 10 ──
    const scored: ScoredPost[] = filteredAnalyses
      .map(a => scorePost(a.post, a.faceResult, a.proxiedUrl))
      .filter(p => p.subjectType !== "NONE")
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    setResults(scored);
    setAppState("complete");
    speak(`Analysis complete. ${scored.length} priority subjects identified.`);

    for (let i = 0; i <= scored.length; i++) {
      await new Promise(r => setTimeout(r, 200));
      setVisibleResults(i);
    }
  }, [username, sessionId]);

  const handleReset = () => {
    abortRef.current = true;
    setAppState("idle"); setResults([]); setVisibleResults(0);
    setError(""); setSubjectInfo(null); setBootLines([]);
    setTimeout(() => {
      let i = 0;
      const id = setInterval(() => {
        if (i < BOOT_LINES.length) { setBootLines(prev => [...prev, BOOT_LINES[i]]); i++; }
        else clearInterval(id);
      }, 280);
    }, 100);
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <JarvisBackground />
      <StatusBar />

      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-8">

        {/* ── IDLE / ERROR ── */}
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
                {authState === "idle" && (
                  <button onClick={handleConnect}
                    className="w-full py-4 text-sm tracking-[0.3em] font-bold rounded"
                    style={{ border: "1px solid rgba(255,107,53,0.5)", color: "#FF6B35", background: "rgba(255,107,53,0.05)", cursor: "pointer", fontFamily: "Space Mono, monospace", transition: "all 0.2s" }}
                    onMouseOver={e => (e.currentTarget.style.background = "rgba(255,107,53,0.12)")}
                    onMouseOut={e => (e.currentTarget.style.background = "rgba(255,107,53,0.05)")}
                  >
                    ◉ CONNECT INSTAGRAM
                  </button>
                )}
                {authState === "connecting" && (
                  <div className="w-full py-4 text-sm tracking-[0.3em] font-bold rounded text-center animate-pulse"
                    style={{ border: "1px solid rgba(255,107,53,0.3)", color: "#FF6B35", fontFamily: "Space Mono, monospace" }}>
                    ◌ AUTHENTICATING — LOG IN TO THE BROWSER WINDOW...
                  </div>
                )}
                {authState === "connected" && (
                  <div className="flex items-center justify-between px-4 py-3 rounded"
                    style={{ border: "1px solid rgba(0,212,255,0.3)", background: "rgba(0,212,255,0.04)" }}>
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: "#00D4FF", display: "inline-block" }} />
                      <span className="text-cyan-jarvis text-xs tracking-widest font-mono">SESSION ACTIVE</span>
                    </div>
                    <button onClick={handleDisconnect} className="text-xs tracking-widest opacity-40 hover:opacity-80 transition-opacity font-mono" style={{ color: "#FF6B35" }}>
                      DISCONNECT
                    </button>
                  </div>
                )}

                <div className="hud-corners p-1">
                  <div className="flex items-center">
                    <span className="px-4 py-3 text-cyan-jarvis opacity-50 text-sm font-mono border-r border-jarvis-border">@</span>
                    <input
                      type="text" value={username}
                      onChange={e => setUsername(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleScan()}
                      placeholder="ENTER INSTAGRAM HANDLE"
                      className="jarvis-input flex-1 px-4 py-3 text-sm uppercase tracking-widest"
                      autoFocus
                    />
                  </div>
                </div>

                <button onClick={handleScan} disabled={!username.trim() || authState !== "connected"}
                  className="jarvis-btn w-full py-4 text-sm tracking-[0.4em] font-bold disabled:opacity-30 disabled:cursor-not-allowed">
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
                { icon: "◫", label: "SUBJECT FILTER", desc: "Only the account owner shown" },
                { icon: "◈", label: "TOP 10", desc: "Best subject photos only" },
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

        {/* ── FETCHING ── */}
        {appState === "fetching" && (
          <ScanLoader target={username.replace(/^@/, "")} />
        )}

        {/* ── LOADING MODELS ── */}
        {appState === "loading-models" && (
          <div className="flex flex-col items-center gap-4 mt-20">
            <p className="glow-cyan text-sm tracking-[0.3em] animate-pulse">LOADING NEURAL VISION MODELS...</p>
            <p className="text-jarvis-text opacity-40 text-xs">First run takes ~15 seconds</p>
          </div>
        )}

        {/* ── ANALYZING ── */}
        {appState === "analyzing" && (
          <div className="w-full max-w-2xl mx-auto mt-12">
            <div className="text-center mb-8">
              <p className="text-xs tracking-[0.4em] text-jarvis-text opacity-50 mb-2">BIOMETRIC SCAN IN PROGRESS</p>
              <p className="text-jarvis-text opacity-30 text-xs">@{username.replace(/^@/, "")}</p>
            </div>
            <ScanProgress {...analyzeProgress} />
          </div>
        )}

        {/* ── CLUSTERING ── */}
        {appState === "clustering" && (
          <div className="flex flex-col items-center gap-8 mt-20 w-full max-w-lg">
            <div className="relative">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth="1" />
                <circle cx="70" cy="70" r="50" fill="none" stroke="rgba(0,212,255,0.15)" strokeWidth="1"
                  strokeDasharray="8 4" style={{ animation: "hudSpin 8s linear infinite", transformOrigin: "70px 70px", transformBox: "fill-box" }} />
                <circle cx="70" cy="70" r="38" fill="none" stroke="#00D4FF" strokeWidth="2"
                  strokeDasharray="60 180" strokeLinecap="round"
                  style={{ animation: "hudSpin 2s linear infinite", transformOrigin: "70px 70px", transformBox: "fill-box", filter: "drop-shadow(0 0 6px #00D4FF)" }} />
                <circle cx="70" cy="70" r="24" fill="none" stroke="rgba(255,107,53,0.4)" strokeWidth="1"
                  strokeDasharray="4 6" style={{ animation: "hudSpin 4s linear infinite reverse", transformOrigin: "70px 70px", transformBox: "fill-box" }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="glow-cyan text-xs tracking-widest text-center">ID<br/>LOCK</span>
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="glow-cyan text-sm tracking-[0.3em] animate-pulse">IDENTIFYING PRIMARY SUBJECT...</p>
              <p className="text-jarvis-text opacity-40 text-xs tracking-widest">{clusterStatus}</p>
            </div>
          </div>
        )}

        {/* ── COMPLETE ── */}
        {appState === "complete" && (
          <div className="w-full max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="glow-cyan text-xl font-bold tracking-widest">SCAN COMPLETE</h2>
                <p className="text-jarvis-text opacity-50 text-xs mt-1 tracking-widest">
                  @{username.replace(/^@/, "")} — {results.length} PRIORITY PHOTOS
                </p>
              </div>
              <button onClick={handleReset} className="jarvis-btn px-4 py-2 text-xs tracking-widest">
                NEW SCAN
              </button>
            </div>

            {subjectInfo && (
              <SubjectProfile
                appearances={subjectInfo.appearances}
                totalScanned={subjectInfo.totalScanned}
                bestPhotoUrl={subjectInfo.bestPhotoUrl}
              />
            )}

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
                  { label: "CLOSE-UP", value: results.filter(r => r.subjectType === "FACE").length, color: "#00D4FF" },
                  { label: "HALF BODY", value: results.filter(r => r.subjectType === "HALF_BODY").length, color: "#00FF88" },
                  { label: "FULL BODY", value: results.filter(r => r.subjectType === "FULL_BODY").length, color: "#FF6B35" },
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
