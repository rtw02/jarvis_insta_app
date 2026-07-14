"use client";
import { useEffect, useRef, useState } from "react";

function LiveClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <>{t}</>;
}

function useLiveTelemetry() {
  const [lat, setLat] = useState(34.0259);
  const [lon, setLon] = useState(118.7798);
  const [latency, setLatency] = useState(4);
  const [signal, setSignal] = useState(88);
  const [neural, setNeural] = useState("NOMINAL");
  const [biometric, setBiometric] = useState(72);

  useEffect(() => {
    const id = setInterval(() => {
      setLat(v => parseFloat((v + (Math.random() - 0.5) * 0.0002).toFixed(4)));
      setLon(v => parseFloat((v + (Math.random() - 0.5) * 0.0002).toFixed(4)));
      setLatency(Math.floor(2 + Math.random() * 7));
      setSignal(Math.floor(78 + Math.random() * 18));
      setNeural(Math.random() < 0.05 ? "ELEVATED" : "NOMINAL");
      setBiometric(Math.floor(68 + Math.random() * 10));
    }, 1200);
    return () => clearInterval(id);
  }, []);

  return { lat, lon, latency, signal, neural, biometric };
}

// Tiny SVG heartbeat spark
function HeartbeatLine({ bpm }: { bpm: number }) {
  const pathRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    let start: number | null = null;
    const period = (60 / bpm) * 1000;
    function tick(ts: number) {
      if (!start) start = ts;
      const elapsed = (ts - start) % period;
      const progress = elapsed / period;
      el!.style.strokeDashoffset = `${len * (1 - progress)}`;
      requestAnimationFrame(tick);
    }
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [bpm]);

  return (
    <svg width="52" height="14" viewBox="0 0 52 14" fill="none">
      <path
        ref={pathRef}
        d="M0 7 L8 7 L11 2 L14 12 L17 4 L20 10 L23 7 L52 7"
        stroke="#00D4FF"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CinematicOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { lat, lon, latency, signal, neural, biometric } = useLiveTelemetry();

  // Film grain
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 256;
    canvas.height = 256;

    let frameId: number;
    let last = 0;

    function tick(ts: number) {
      frameId = requestAnimationFrame(tick);
      if (ts - last < 50) return;
      last = ts;
      const img = ctx!.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 38;
        img.data[i]     = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v + Math.random() * 8;
        img.data[i + 3] = 255;
      }
      ctx!.putImageData(img, 0, 0);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const signalBars = Math.round(signal / 20); // 0-5
  const signalStr = "█".repeat(signalBars) + "░".repeat(5 - signalBars);

  return (
    <>
      {/* Film grain */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ width: "100vw", height: "100vh", opacity: 0.038, mixBlendMode: "screen", zIndex: 9990, imageRendering: "pixelated" }}
      />

      {/* Vignette */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 72% 72% at 50% 50%, transparent 35%, rgba(0,0,0,0.45) 68%, rgba(0,0,0,0.82) 100%)",
        zIndex: 9991,
      }} />

      {/* Chromatic edge */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 55% 55% at 50% 50%, transparent 48%, rgba(0,212,255,0.012) 78%, rgba(255,30,60,0.018) 100%)",
        zIndex: 9992, mixBlendMode: "screen",
      }} />

      {/* Scanlines */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.025) 2px, rgba(0,0,0,0.025) 4px)",
        zIndex: 9993,
      }} />

      {/* Top-left telemetry */}
      <div className="fixed pointer-events-none font-mono" style={{ top: 64, left: 16, zIndex: 9994, color: "rgba(0,212,255,0.22)", fontSize: 9, letterSpacing: "0.18em", lineHeight: 1.7 }}>
        <div>SYS // RYAN.AI v0.1</div>
        <div>LAT {lat.toFixed(4)}° N</div>
        <div>LON {lon.toFixed(4)}° W</div>
        <div>ALT 038m ASL</div>
        <div>FOV 045°</div>
      </div>

      {/* Top-right telemetry */}
      <div className="fixed pointer-events-none font-mono text-right" style={{ top: 64, right: 16, zIndex: 9994, color: "rgba(0,212,255,0.22)", fontSize: 9, letterSpacing: "0.18em", lineHeight: 1.7 }}>
        <div>MODE // AR-HUD</div>
        <div style={{ color: neural === "ELEVATED" ? "rgba(255,140,30,0.5)" : "rgba(0,212,255,0.22)" }}>
          NEURAL ● {neural}
        </div>
        <div>ENCRYPT ● AES-256</div>
        <div><LiveClock /></div>
      </div>

      {/* Bottom-left */}
      <div className="fixed pointer-events-none font-mono" style={{ bottom: 32, left: 16, zIndex: 9994, color: "rgba(0,212,255,0.15)", fontSize: 9, letterSpacing: "0.18em", lineHeight: 1.9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <HeartbeatLine bpm={biometric} />
          <span>{biometric} BPM</span>
        </div>
        <div>◈ BIOMETRIC STABLE</div>
        <div>⊕ GPS LOCK</div>
      </div>

      {/* Bottom-right */}
      <div className="fixed pointer-events-none font-mono text-right" style={{ bottom: 32, right: 16, zIndex: 9994, color: "rgba(0,212,255,0.15)", fontSize: 9, letterSpacing: "0.18em", lineHeight: 1.7 }}>
        <div>SIGNAL {signalStr} {signal}%</div>
        <div style={{ color: latency > 6 ? "rgba(255,140,30,0.4)" : "rgba(0,212,255,0.15)" }}>
          LATENCY {String(latency).padStart(3, "0")}ms
        </div>
        <div>REACTOR ● ONLINE</div>
      </div>

      {/* Center crosshair */}
      <div className="fixed pointer-events-none" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 9994 }}>
        <svg width="28" height="28" viewBox="0 0 28 28">
          <line x1="14" y1="0"  x2="14" y2="9"  stroke="rgba(0,212,255,0.22)" strokeWidth="0.8" />
          <line x1="14" y1="19" x2="14" y2="28" stroke="rgba(0,212,255,0.22)" strokeWidth="0.8" />
          <line x1="0"  y1="14" x2="9"  y2="14" stroke="rgba(0,212,255,0.22)" strokeWidth="0.8" />
          <line x1="19" y1="14" x2="28" y2="14" stroke="rgba(0,212,255,0.22)" strokeWidth="0.8" />
          <circle cx="14" cy="14" r="2.5" fill="none" stroke="rgba(0,212,255,0.18)" strokeWidth="0.8" />
        </svg>
      </div>
    </>
  );
}
