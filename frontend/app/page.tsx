"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import JarvisBackground from "@/components/JarvisBackground";
import StatusBar from "@/components/StatusBar";
import ScanProgress from "@/components/ScanProgress";
import DossierCard from "@/components/DossierCard";
import SubjectProfile from "@/components/SubjectProfile";
import ScanLoader from "@/components/ScanLoader";
import BriefingTab from "@/components/BriefingTab";
import FriendsTab from "@/components/FriendsTab";
import { fetchProfile, proxyUrl, connectInstagram } from "@/lib/api";
import { loadModels, detectFaces, loadImageElement } from "@/lib/faceDetection";
import { scorePost } from "@/lib/scoring";
import { clusterFaces, findMainSubject } from "@/lib/clustering";
import type { ScoredPost } from "@/lib/scoring";
import type { FaceResult } from "@/lib/faceDetection";
import type { RawPost } from "@/lib/api";

type Tab = "briefing" | "friends" | "intel";
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
  const [activeTab, setActiveTab] = useState<Tab>("briefing");
  const [appState, setAppState] = useState<AppState>("idle");
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [username, setUsername] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0, found: 0, status: "" });
  const [clusterStatus, setClusterStatus] = useState("");
  const [results, setResults] = useState<ScoredPost[]>([]);
  const [rawPosts, setRawPosts] = useState<RawPost[]>([]);
  const [visibleResults, setVisibleResults] = useState(0);
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo | null>(null);
  const [scanSummary, setScanSummary] = useState<{ total: number; from: string; to: string } | null>(null);
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
    setError(""); setResults([]); setRawPosts([]); setVisibleResults(0); setSubjectInfo(null); setScanSummary(null);

    // ── Phase 1: Fetch posts (cached) ──
    setAppState("fetching");
    speak(`Initiating scan on ${handle}.`);

    let posts: RawPost[];
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

    setRawPosts(posts);
    if (posts.length > 0) {
      const times = posts.map(p => new Date(p.timestamp).getTime()).filter(t => !isNaN(t));
      if (times.length > 0) {
        const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
        setScanSummary({ total: posts.length, from: fmt(new Date(Math.min(...times))), to: fmt(new Date(Math.max(...times))) });
      }
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
            analyses.push({ post, faceResult: { hasPerson: false, faceCount: 0, maxFaceAreaPct: 0, descriptors: [] }, proxiedUrl: proxied });
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

    // ── Phase 4: Cluster faces → pick person who appears most ──
    setAppState("clustering");
    setClusterStatus("BUILDING BIOMETRIC CLUSTERS...");
    speak("Identifying primary subject.");

    await new Promise(r => setTimeout(r, 100)); // yield to render

    let filteredAnalyses: PostAnalysis[];
    let bestPhotoUrl = "";
    let localSubjectInfo: SubjectInfo | null = null;
    let localClusterStatus = "";

    function euclidean(a: Float32Array, b: Float32Array): number {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
      return Math.sqrt(sum);
    }

    // Step 1: Identify subject using FACE-tier solo shots (close-up = most reliable descriptors)
    const faceTierSoloEntries: { descriptor: Float32Array; postIndex: number }[] = [];
    analyses.forEach((a, idx) => {
      if (a.faceResult.faceCount === 1 && a.faceResult.maxFaceAreaPct >= 10) {
        faceTierSoloEntries.push({ descriptor: a.faceResult.descriptors[0], postIndex: idx });
      }
    });

    // Fall back to all solo shots if no close-up solos
    const allSoloEntries: { descriptor: Float32Array; postIndex: number }[] = [];
    analyses.forEach((a, idx) => {
      if (a.faceResult.faceCount === 1) {
        allSoloEntries.push({ descriptor: a.faceResult.descriptors[0], postIndex: idx });
      }
    });

    const clusterEntries = faceTierSoloEntries.length > 0 ? faceTierSoloEntries : allSoloEntries;

    // Fall back to all faces if no solo photos at all
    const fallbackEntries = clusterEntries.length > 0 ? clusterEntries : (() => {
      const all: { descriptor: Float32Array; postIndex: number }[] = [];
      analyses.forEach((a, idx) => { for (const d of a.faceResult.descriptors) all.push({ descriptor: d, postIndex: idx }); });
      return all;
    })();

    const clusters = clusterFaces(fallbackEntries);

    const postFaceCounts = new Map<number, number>();
    analyses.forEach((a, idx) => {
      if (a.faceResult.faceCount > 0) postFaceCounts.set(idx, a.faceResult.faceCount);
    });

    const mainCluster = findMainSubject(clusters, postFaceCounts);

    // Step 2: Match all solo photos (any tier) against the identified centroid
    // Looser threshold (0.6) catches same person in half-body/full-body shots
    const MATCH_THRESHOLD = 0.65;
    const mainFaceAnalyses = mainCluster
      ? analyses.filter(a =>
          a.faceResult.faceCount === 1 &&
          a.faceResult.descriptors.some(d => euclidean(d, mainCluster.centroid) < MATCH_THRESHOLD)
        )
      : [];

    // Fallback: if clustering finds no subject, show all solo face photos
    const allFaceAnalyses = analyses.filter(a => a.faceResult.faceCount === 1);
    filteredAnalyses = mainFaceAnalyses.length > 0 ? mainFaceAnalyses : allFaceAnalyses;

    if (mainCluster && mainFaceAnalyses.length > 0) {
      const best = mainFaceAnalyses.reduce((b, a) =>
        a.faceResult.maxFaceAreaPct > b.faceResult.maxFaceAreaPct ? a : b
      );
      bestPhotoUrl = best.proxiedUrl;
      const appearances = mainFaceAnalyses.length;
      localSubjectInfo = { appearances, totalScanned: analyses.length, bestPhotoUrl };
      localClusterStatus = `PRIMARY SUBJECT IDENTIFIED — ${appearances} APPEARANCES ACROSS ${clusters.length} UNIQUE FACES`;
      setSubjectInfo(localSubjectInfo);
      setClusterStatus(localClusterStatus);
      speak(`Primary subject identified. ${appearances} appearances detected.`);
    } else if (allFaceAnalyses.length > 0) {
      const best = allFaceAnalyses.reduce((b, a) =>
        a.faceResult.maxFaceAreaPct > b.faceResult.maxFaceAreaPct ? a : b
      );
      bestPhotoUrl = best.proxiedUrl;
      localSubjectInfo = { appearances: allFaceAnalyses.length, totalScanned: analyses.length, bestPhotoUrl };
      localClusterStatus = `${allFaceAnalyses.length} PHOTOS WITH FACES DETECTED`;
      setSubjectInfo(localSubjectInfo);
      setClusterStatus(localClusterStatus);
      speak(`${allFaceAnalyses.length} photos with faces detected.`);
    } else {
      localClusterStatus = "NO FACES DETECTED";
      setClusterStatus(localClusterStatus);
    }

    await new Promise(r => setTimeout(r, 800)); // show cluster status briefly

    // ── Phase 5: Score + rank top 10 ──
    const SUBJECT_ORDER: Record<string, number> = { FACE: 0, HALF_BODY: 1, FULL_BODY: 2, NONE: 3 };
    const scored: ScoredPost[] = filteredAnalyses
      .map(a => scorePost(a.post, a.faceResult, a.proxiedUrl))
      .filter(p => p.subjectType !== "NONE")
      .sort((a, b) => {
        const typeDiff = SUBJECT_ORDER[a.subjectType] - SUBJECT_ORDER[b.subjectType];
        return typeDiff !== 0 ? typeDiff : b.score - a.score;
      })
;

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
    setAppState("idle"); setResults([]); setRawPosts([]); setVisibleResults(0);
    setError(""); setSubjectInfo(null); setScanSummary(null); setBootLines([]);
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

      {/* Tab navigation */}
      <div className="relative z-10 flex items-center border-b font-mono px-4"
        style={{ borderColor: "rgba(0,212,255,0.12)" }}>
        {/* Main tabs */}
        <div className="flex flex-1">
          {(["briefing", "friends"] as Tab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-8 py-2.5 text-xs tracking-[0.3em] transition-all"
              style={{
                color: activeTab === tab ? "#00D4FF" : "rgba(255,255,255,0.25)",
                background: activeTab === tab ? "rgba(0,212,255,0.04)" : "transparent",
                borderBottom: activeTab === tab ? "2px solid #00D4FF" : "2px solid transparent",
                marginBottom: "-1px",
              }}>
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
        {/* Intel button — top right */}
        <button onClick={() => setActiveTab(activeTab === "intel" ? "briefing" : "intel")}
          className="px-4 py-1.5 text-xs tracking-[0.25em] font-mono rounded transition-all"
          style={{
            color: activeTab === "intel" ? "#FF6B35" : "rgba(255,255,255,0.3)",
            border: activeTab === "intel" ? "1px solid rgba(255,107,53,0.6)" : "1px solid rgba(255,255,255,0.1)",
            background: activeTab === "intel" ? "rgba(255,107,53,0.08)" : "transparent",
          }}>
          {activeTab === "intel" ? "← BACK" : "◈ SCANNER"}
        </button>
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-8">

        {/* ── BRIEFING TAB ── */}
        {activeTab === "briefing" && <BriefingTab />}

        {/* ── FRIENDS TAB ── */}
        {activeTab === "friends" && <FriendsTab />}

        {/* ── INTEL TAB ── */}
        {activeTab === "intel" && <>

        {/* ── IDLE / ERROR ── */}
        {(appState === "idle" || appState === "error") && (
          <div className="w-full max-w-2xl mx-auto mt-8 flex flex-col items-center gap-8">
            <div className="text-center space-y-2">
              <h1 className="text-5xl font-bold tracking-[0.4em] glow-cyan glitch-text" data-text="JOHNNY.AI">
                JOHNNY.AI
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
                { icon: "◈", label: "ALL PHOTOS", desc: "Every photo of the subject" },
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
                  {scanSummary && ` · SCANNED ${scanSummary.total} POSTS · ${scanSummary.from} – ${scanSummary.to}`}
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
              <div className="w-full">
                <p className="text-center text-jarvis-text opacity-40 tracking-widest mb-6 text-xs">
                  NO SUBJECTS IDENTIFIED — SHOWING {Math.min(rawPosts.length, 10)} MOST RECENT POSTS
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {rawPosts.slice(0, 10).map((post) => {
                    const proxied = proxyUrl(post.url);
                    const date = new Date(post.timestamp).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
                    return (
                      <div key={post.id} className="dossier-card rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 text-xs tracking-widest" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <span className="text-jarvis-text opacity-40">RECENT</span>
                          {post.is_video && <span className="text-xs" style={{ color: "#FF6B35" }}>▶ REEL</span>}
                        </div>
                        <div className="relative aspect-square bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={proxied} alt="post" className="w-full h-full object-cover" />
                          <div className="absolute top-1 left-1 w-3 h-3 border-t border-l opacity-40" style={{ borderColor: "#00D4FF" }} />
                          <div className="absolute top-1 right-1 w-3 h-3 border-t border-r opacity-40" style={{ borderColor: "#00D4FF" }} />
                          <div className="absolute bottom-1 left-1 w-3 h-3 border-b border-l opacity-40" style={{ borderColor: "#00D4FF" }} />
                          <div className="absolute bottom-1 right-1 w-3 h-3 border-b border-r opacity-40" style={{ borderColor: "#00D4FF" }} />
                        </div>
                        <div className="p-3 space-y-1 text-xs font-mono">
                          <div className="flex justify-between">
                            <span className="text-jarvis-text opacity-40">DATE</span>
                            <span className="text-jarvis-text">{date}</span>
                          </div>
                          {post.likes > 0 && (
                            <div className="flex justify-between">
                              <span className="text-jarvis-text opacity-40">LIKES</span>
                              <span className="text-jarvis-text">{post.likes.toLocaleString()}</span>
                            </div>
                          )}
                          <a href={post.post_url} target="_blank" rel="noopener noreferrer"
                            className="block text-center pt-1 tracking-widest opacity-40 hover:opacity-80 transition-opacity"
                            style={{ color: "#00D4FF" }}>
                            VIEW POST →
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
        </>}
      </main>
    </div>
  );
}
