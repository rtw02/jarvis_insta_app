"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "ACCESSING INSTAGRAM DATABASE...",
  "RETRIEVING POST MANIFEST...",
  "DECRYPTING MEDIA METADATA...",
  "MAPPING CONTENT TIMELINE...",
  "ESTABLISHING SECURE CHANNEL...",
  "PARSING SUBJECT ARCHIVE...",
];

function randomHex(len: number) {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join("");
}

function DataStream() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    const build = () =>
      `${randomHex(4)}  ${randomHex(8)}  ${randomHex(4)}  ${randomHex(8)}  ${randomHex(4)}`;
    setLines(Array.from({ length: 8 }, build));
    const id = setInterval(() => {
      setLines(prev => {
        const next = [...prev];
        next[Math.floor(Math.random() * next.length)] = build();
        return next;
      });
    }, 80);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="font-mono text-xs space-y-1 opacity-20 select-none" style={{ color: "#00D4FF" }}>
      {lines.map((line, i) => <div key={i} className="tracking-widest">{line}</div>)}
    </div>
  );
}

// Static blip positions — fixed coords inside the radar circle
const BLIPS = [
  { x: 62, y: 48, delay: "0s", dur: "2.4s" },
  { x: 138, y: 72, delay: "0.6s", dur: "3.1s" },
  { x: 80, y: 130, delay: "1.2s", dur: "2.7s" },
  { x: 148, y: 118, delay: "1.9s", dur: "3.4s" },
  { x: 104, y: 58, delay: "0.4s", dur: "2.9s" },
  { x: 52, y: 96, delay: "2.1s", dur: "2.2s" },
  { x: 130, y: 148, delay: "0.9s", dur: "3.6s" },
];

interface Props { target: string }

export default function ScanLoader({ target }: Props) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 1800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 mt-12 w-full max-w-lg mx-auto">

      {/* Radar — w-52 matches SVG viewBox 208px so no scaling distortion */}
      <div className="relative w-52 h-52">

        {/* Static SVG — rings, crosshairs, blips, center */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 208 208" style={{ zIndex: 2 }}>
          {/* Range rings */}
          {[24, 48, 72, 96].map((r, i) => (
            <circle key={r} cx="104" cy="104" r={r}
              fill="none" stroke="#00D4FF"
              strokeWidth={i === 3 ? 1 : 0.5}
              opacity={i === 3 ? 0.3 : 0.12}
            />
          ))}

          {/* Crosshairs */}
          <line x1="104" y1="8" x2="104" y2="200" stroke="#00D4FF" strokeWidth="0.5" opacity="0.15" />
          <line x1="8" y1="104" x2="200" y2="104" stroke="#00D4FF" strokeWidth="0.5" opacity="0.15" />
          <line x1="36" y1="36" x2="172" y2="172" stroke="#00D4FF" strokeWidth="0.4" opacity="0.07" strokeDasharray="3 5" />
          <line x1="172" y1="36" x2="36" y2="172" stroke="#00D4FF" strokeWidth="0.4" opacity="0.07" strokeDasharray="3 5" />

          {/* Tick marks */}
          {Array.from({ length: 36 }).map((_, i) => {
            const rad = ((i / 36) * 360 - 90) * Math.PI / 180;
            const major = i % 9 === 0;
            const r1 = major ? 90 : 93;
            return (
              <line key={i}
                x1={104 + r1 * Math.cos(rad)} y1={104 + r1 * Math.sin(rad)}
                x2={104 + 96 * Math.cos(rad)} y2={104 + 96 * Math.sin(rad)}
                stroke="#00D4FF" strokeWidth={major ? 1.5 : 0.5} opacity={major ? 0.5 : 0.2}
              />
            );
          })}

          {/* Blips */}
          {BLIPS.map((b, i) => (
            <g key={i}>
              <circle cx={b.x} cy={b.y} r="3" fill="#FF6B35">
                <animate attributeName="opacity" values="0;1;0" dur={b.dur} begin={b.delay} repeatCount="indefinite" />
              </circle>
              <circle cx={b.x} cy={b.y} r="6" fill="none" stroke="#FF6B35" strokeWidth="0.8">
                <animate attributeName="opacity" values="0;0.5;0" dur={b.dur} begin={b.delay} repeatCount="indefinite" />
                <animate attributeName="r" values="3;9;3" dur={b.dur} begin={b.delay} repeatCount="indefinite" />
              </circle>
            </g>
          ))}

          {/* Center */}
          <circle cx="104" cy="104" r="3" fill="#00D4FF" style={{ filter: "drop-shadow(0 0 6px #00D4FF)" }} />
          <circle cx="104" cy="104" r="7" fill="none" stroke="#00D4FF" strokeWidth="0.8" opacity="0.4" />
        </svg>

        {/* Sweep — pure CSS conic-gradient rotation, no JS */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            zIndex: 1,
            animation: "hudSpin 3s linear infinite",
            transformOrigin: "center",
            background: `conic-gradient(
              from 0deg at 50% 50%,
              transparent 0deg,
              transparent 280deg,
              rgba(0,212,255,0.02) 300deg,
              rgba(0,212,255,0.06) 320deg,
              rgba(0,212,255,0.14) 340deg,
              rgba(0,212,255,0.35) 355deg,
              rgba(0,212,255,0.6) 359deg,
              transparent 360deg
            )`,
            maskImage: "radial-gradient(circle 95px at center, black 97%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(circle 95px at center, black 97%, transparent 100%)",
          }}
        />

        {/* Sweep line — thin bright line at 0deg, rotates with the gradient */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 1, animation: "hudSpin 3s linear infinite", transformOrigin: "center" }}
        >
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "96px",
            height: "1.5px",
            marginTop: "-0.75px",
            transformOrigin: "0% 50%",
            background: "linear-gradient(90deg, rgba(0,212,255,0.8), rgba(0,212,255,0.2))",
            boxShadow: "0 0 6px rgba(0,212,255,0.8)",
          }} />
        </div>

        {/* Target label */}
        <div className="absolute bottom-0 left-0 right-0 text-center" style={{ zIndex: 3 }}>
          <span className="text-jarvis-text opacity-30 font-mono" style={{ fontSize: "9px", letterSpacing: "0.2em" }}>
            @{target}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="text-center">
        <p key={msgIdx} className="glow-cyan text-xs tracking-[0.2em] font-mono"
          style={{ animation: "fadeUp 0.3s ease forwards" }}>
          {MESSAGES[msgIdx]}{".".repeat(dots)}
        </p>
      </div>

      {/* Data stream */}
      <div className="w-full border-glow rounded p-4 bg-jarvis-card/50">
        <div className="text-cyan-jarvis opacity-30 text-xs font-mono mb-2 tracking-widest">// DATA STREAM</div>
        <DataStream />
      </div>
    </div>
  );
}
