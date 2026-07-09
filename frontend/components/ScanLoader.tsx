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
        const idx = Math.floor(Math.random() * next.length);
        next[idx] = build();
        return next;
      });
    }, 80);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="font-mono text-xs space-y-1 opacity-20 select-none" style={{ color: "#00D4FF" }}>
      {lines.map((line, i) => (
        <div key={i} className="tracking-widest">{line}</div>
      ))}
    </div>
  );
}

interface Props {
  target: string;
}

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

      {/* HUD rings */}
      <div className="relative w-52 h-52 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 208 208">
          {/* Outer slow ring */}
          <circle cx="104" cy="104" r="98" fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth="1" />
          <circle cx="104" cy="104" r="98" fill="none" stroke="#00D4FF" strokeWidth="1"
            strokeDasharray="40 580" strokeLinecap="round"
            style={{ animation: "hudSpin 12s linear infinite", transformOrigin: "104px 104px", transformBox: "fill-box", filter: "drop-shadow(0 0 3px rgba(0,212,255,0.6))" }} />

          {/* Second ring */}
          <circle cx="104" cy="104" r="82" fill="none" stroke="rgba(0,212,255,0.06)" strokeWidth="1" />
          <circle cx="104" cy="104" r="82" fill="none" stroke="#00D4FF" strokeWidth="1.5"
            strokeDasharray="20 496" strokeLinecap="round"
            style={{ animation: "hudSpin 7s linear infinite reverse", transformOrigin: "104px 104px", transformBox: "fill-box", filter: "drop-shadow(0 0 4px rgba(0,212,255,0.8))" }} />

          {/* Third ring — faster */}
          <circle cx="104" cy="104" r="66" fill="none" stroke="rgba(0,212,255,0.06)" strokeWidth="1" />
          <circle cx="104" cy="104" r="66" fill="none" stroke="#FF6B35" strokeWidth="1.5"
            strokeDasharray="60 354" strokeLinecap="round"
            style={{ animation: "hudSpin 4s linear infinite", transformOrigin: "104px 104px", transformBox: "fill-box", filter: "drop-shadow(0 0 4px rgba(255,107,53,0.8))" }} />

          {/* Inner ring */}
          <circle cx="104" cy="104" r="50" fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="1"
            strokeDasharray="4 6"
            style={{ animation: "hudSpin 20s linear infinite reverse", transformOrigin: "104px 104px", transformBox: "fill-box" }} />

          {/* Tick marks on outer ring */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * 2 * Math.PI - Math.PI / 2;
            const r1 = 94, r2 = 98;
            return (
              <line key={i}
                x1={104 + r1 * Math.cos(angle)} y1={104 + r1 * Math.sin(angle)}
                x2={104 + r2 * Math.cos(angle)} y2={104 + r2 * Math.sin(angle)}
                stroke="#00D4FF" strokeWidth={i % 6 === 0 ? 2 : 0.5} opacity={i % 6 === 0 ? 0.6 : 0.2}
              />
            );
          })}

          {/* Cross-hair lines */}
          <line x1="104" y1="40" x2="104" y2="62" stroke="#00D4FF" strokeWidth="0.5" opacity="0.3" />
          <line x1="104" y1="146" x2="104" y2="168" stroke="#00D4FF" strokeWidth="0.5" opacity="0.3" />
          <line x1="40" y1="104" x2="62" y2="104" stroke="#00D4FF" strokeWidth="0.5" opacity="0.3" />
          <line x1="146" y1="104" x2="168" y2="104" stroke="#00D4FF" strokeWidth="0.5" opacity="0.3" />
        </svg>

        {/* Center content */}
        <div className="relative z-10 text-center space-y-1">
          {/* Pulsing core */}
          <div className="flex justify-center mb-2">
            <div className="relative">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#00D4FF", boxShadow: "0 0 12px #00D4FF" }} />
              <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: "rgba(0,212,255,0.4)" }} />
            </div>
          </div>
          <div className="glow-cyan text-xs font-bold tracking-widest">SCANNING</div>
          <div className="text-jarvis-text opacity-40 text-xs font-mono">
            @{target}
          </div>
        </div>
      </div>

      {/* Cycling status message */}
      <div className="text-center space-y-1 w-full">
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
