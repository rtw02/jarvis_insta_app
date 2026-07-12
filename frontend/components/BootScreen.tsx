"use client";

import { useEffect, useState } from "react";

const LINES = [
  "> INITIALIZING JARVIS SYSTEM...",
  "> LOADING NEURAL INTERFACE...",
  "> CALIBRATING SENSOR ARRAY...",
  "> ESTABLISHING SECURE CHANNEL...",
  "> BIOMETRIC AUTH CONFIRMED.",
  "> ALL SYSTEMS NOMINAL.",
];

// Orbit dot positions on sphere equator
const ORBIT_DOTS = [0, 60, 120, 180, 240, 300].map(deg => {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: 150 + 146 * Math.cos(rad), y: 150 + 146 * Math.sin(rad) };
});

export default function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let idx = 0;

    const addLine = () => {
      setLines(prev => [...prev, LINES[idx]]);
      idx++;
      if (idx < LINES.length) {
        setTimeout(addLine, 300);
      } else {
        setTimeout(() => {
          setExiting(true);
          setTimeout(onComplete, 750);
        }, 500);
      }
    };

    const t = setTimeout(addLine, 350);
    return () => clearTimeout(t);
  }, [onComplete]);

  const pct = Math.round((lines.length / LINES.length) * 100);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#050508",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
      opacity: exiting ? 0 : 1,
      transform: exiting ? "scale(1.06)" : "scale(1)",
      transition: exiting ? "opacity 0.75s ease, transform 0.75s ease" : "none",
    }}>

      {/* Background grid */}
      <div className="absolute inset-0 jarvis-grid" style={{ opacity: 0.2 }} />

      {/* CRT scanlines */}
      <div className="absolute inset-0 crt-overlay" />

      {/* Corner HUD brackets */}
      {[
        { cls: "top-0 left-0",    flip: undefined },
        { cls: "top-0 right-0",   flip: "scaleX(-1)" },
        { cls: "bottom-0 left-0", flip: "scaleY(-1)" },
        { cls: "bottom-0 right-0",flip: "scale(-1,-1)" },
      ].map(({ cls, flip }, i) => (
        <svg key={i} className={`absolute ${cls}`}
          style={{ width: 200, height: 200, opacity: 0.18, transform: flip }}
          viewBox="0 0 200 200" fill="none">
          <path d="M0 0 L90 0 L90 2 L2 2 L2 90 L0 90 Z" fill="#00D4FF" />
          {[20, 35, 50, 65, 80].map(v => (
            <line key={`h${v}`} x1={v} y1="0" x2={v} y2="5" stroke="#00D4FF" strokeWidth="0.5" opacity="0.5" />
          ))}
          {[20, 35, 50, 65, 80].map(v => (
            <line key={`v${v}`} x1="0" y1={v} x2="5" y2={v} stroke="#00D4FF" strokeWidth="0.5" opacity="0.5" />
          ))}
          <line x1="0" y1="0" x2="14" y2="14" stroke="#00D4FF" strokeWidth="0.5" opacity="0.3" />
        </svg>
      ))}

      {/* Header label */}
      <div style={{
        fontFamily: "Space Mono, monospace",
        fontSize: 10, letterSpacing: "0.55em",
        color: "rgba(0,212,255,0.35)",
        marginBottom: 28, textTransform: "uppercase",
      }}>
        J.A.R.V.I.S &nbsp; INTERFACE &nbsp; v4.2.1
      </div>

      {/* ── 3D sphere ── */}
      <div style={{ position: "relative", width: 300, height: 300, perspective: "700px" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d" }}>

          {/* Radar scan sweep */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "conic-gradient(from 0deg, transparent 305deg, rgba(0,212,255,0.22) 350deg, rgba(0,212,255,0.06) 360deg)",
            animation: "scanRotate 2.4s linear infinite",
          }} />

          {/* Outer halo glow */}
          <div style={{
            position: "absolute", inset: -14, borderRadius: "50%",
            boxShadow: "0 0 60px rgba(0,212,255,0.1), 0 0 120px rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,212,255,0.05)",
          }} />

          {/* Ring: equatorial */}
          <div style={{ position: "absolute", inset: 0 }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1.5px dashed rgba(0,212,255,0.28)", animation: "hudSpin 10s linear infinite" }} />
          </div>

          {/* Ring: 30° */}
          <div style={{ position: "absolute", inset: 0, transform: "rotateX(30deg)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1px solid rgba(0,212,255,0.22)", animation: "hudSpin 14s linear infinite reverse" }} />
          </div>

          {/* Ring: 60° */}
          <div style={{ position: "absolute", inset: 0, transform: "rotateX(60deg)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1px dashed rgba(0,212,255,0.18)", animation: "hudSpin 7s linear infinite" }} />
          </div>

          {/* Ring: near-polar 80° */}
          <div style={{ position: "absolute", inset: "20px", transform: "rotateX(80deg)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "0.5px solid rgba(0,212,255,0.15)", animation: "hudSpin 4.5s linear infinite reverse" }} />
          </div>

          {/* Ring: -45° */}
          <div style={{ position: "absolute", inset: "10px", transform: "rotateX(-45deg)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1px dashed rgba(0,212,255,0.15)", animation: "hudSpin 18s linear infinite" }} />
          </div>

          {/* Fast bright arc */}
          <div style={{ position: "absolute", inset: "35px" }}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              border: "2.5px solid transparent",
              borderTopColor: "#00D4FF", borderRightColor: "rgba(0,212,255,0.3)",
              boxShadow: "0 0 18px rgba(0,212,255,0.7), 0 0 36px rgba(0,212,255,0.3)",
              animation: "hudSpin 1.8s linear infinite",
            }} />
          </div>

          {/* Counter-arc 90° tilt */}
          <div style={{ position: "absolute", inset: "45px", transform: "rotateX(90deg)" }}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              border: "1.5px solid transparent", borderBottomColor: "rgba(0,212,255,0.55)",
              boxShadow: "0 0 8px rgba(0,212,255,0.5)",
              animation: "hudSpin 2.2s linear infinite reverse",
            }} />
          </div>

          {/* Orange accent arc */}
          <div style={{ position: "absolute", inset: "55px", transform: "rotateX(40deg)" }}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              border: "1px solid transparent", borderTopColor: "rgba(255,107,53,0.45)",
              animation: "hudSpin 5s linear infinite",
            }} />
          </div>

          {/* Orbit dots */}
          {ORBIT_DOTS.map(({ x, y }, i) => (
            <div key={i} style={{
              position: "absolute", left: x - 3, top: y - 3,
              width: 6, height: 6, borderRadius: "50%",
              background: "#00D4FF",
              boxShadow: "0 0 10px rgba(0,212,255,0.9), 0 0 20px rgba(0,212,255,0.5)",
              opacity: 0.7,
            }} />
          ))}

          {/* Arc reactor core */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
            {/* Ring 1 */}
            <div style={{
              position: "absolute", inset: -34, borderRadius: "50%",
              border: "1px solid rgba(0,212,255,0.35)",
              animation: "bootPulse 2.4s ease-in-out infinite",
            }} />
            {/* Ring 2 */}
            <div style={{
              position: "absolute", inset: -20, borderRadius: "50%",
              border: "2px solid rgba(0,212,255,0.6)",
              boxShadow: "0 0 20px rgba(0,212,255,0.5), inset 0 0 20px rgba(0,212,255,0.2)",
              animation: "bootPulse 2s ease-in-out infinite 0.4s",
            }} />
            {/* Inner glow */}
            <div style={{
              position: "absolute", inset: -10, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(0,212,255,0.85) 0%, rgba(0,100,200,0.3) 60%, transparent 100%)",
              boxShadow: "0 0 32px rgba(0,212,255,0.9), 0 0 64px rgba(0,212,255,0.4)",
              animation: "bootPulse 1.8s ease-in-out infinite",
            }} />
            {/* Bright center point */}
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 0 12px #fff, 0 0 24px rgba(0,212,255,1), 0 0 48px rgba(0,212,255,0.6)",
            }} />
          </div>

        </div>
      </div>

      {/* Boot text lines */}
      <div style={{
        width: 360, marginTop: 36,
        fontFamily: "Space Mono, monospace",
        fontSize: 11, letterSpacing: "0.05em",
        minHeight: 130,
      }}>
        {lines.map((line, i) => (
          <div key={i} style={{
            padding: "3px 0",
            color: i === lines.length - 1 ? "#00D4FF" : "rgba(0,212,255,0.32)",
            animation: "bootLineIn 0.18s ease forwards",
          }}>
            {line}
            {i === lines.length - 1 && (
              <span style={{ animation: "blink 1s step-end infinite" }}>_</span>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{
        position: "absolute", bottom: 44,
        left: "50%", transform: "translateX(-50%)",
        width: 320,
      }}>
        <div style={{ height: 1, background: "rgba(0,212,255,0.1)", marginBottom: 8, overflow: "hidden", position: "relative" }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "#00D4FF",
            boxShadow: "0 0 8px rgba(0,212,255,0.8), 0 0 16px rgba(0,212,255,0.4)",
            width: `${pct}%`,
            transition: "width 0.3s ease",
          }} />
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontFamily: "Space Mono, monospace", fontSize: 9,
          color: "rgba(0,212,255,0.22)", letterSpacing: "0.25em",
        }}>
          <span>SYSTEM LOAD</span>
          <span>{pct}%</span>
        </div>
      </div>

    </div>
  );
}
