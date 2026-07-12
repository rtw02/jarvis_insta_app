"use client";

const PARTICLES = [
  { left: "12%", delay: "0s",   dur: "7s",  size: 2 },
  { left: "28%", delay: "1.5s", dur: "9s",  size: 1.5 },
  { left: "45%", delay: "3s",   dur: "6s",  size: 2.5 },
  { left: "63%", delay: "0.8s", dur: "8s",  size: 1 },
  { left: "78%", delay: "2.2s", dur: "11s", size: 2 },
  { left: "91%", delay: "4s",   dur: "7.5s",size: 1.5 },
  { left: "5%",  delay: "5s",   dur: "9s",  size: 1 },
  { left: "55%", delay: "2s",   dur: "10s", size: 2 },
];

export default function JarvisBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Flat grid */}
      <div className="absolute inset-0 jarvis-grid opacity-40" />

      {/* Perspective floor grid */}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: "45%", perspective: "500px", perspectiveOrigin: "50% 0%" }}>
        <div className="absolute inset-0" style={{
          transformOrigin: "top center",
          transform: "rotateX(55deg)",
          backgroundImage: "linear-gradient(rgba(0,212,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.07) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.6) 80%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.6) 80%, transparent)",
        }} />
      </div>

      {/* Radial glow top */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(0,212,255,0.07) 0%, transparent 70%)",
      }} />

      {/* Horizontal sweep lines */}
      <div className="sweep-line absolute left-0 right-0 h-px" style={{
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.12), rgba(0,212,255,0.35), rgba(0,212,255,0.12), transparent)",
        boxShadow: "0 0 8px rgba(0,212,255,0.25)",
        animationDuration: "8s",
      }} />
      <div className="sweep-line absolute left-0 right-0 h-px" style={{
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.06), rgba(0,212,255,0.18), rgba(0,212,255,0.06), transparent)",
        animationDuration: "14s",
        animationDelay: "5s",
      }} />

      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <div key={i} className="absolute rounded-full" style={{
          left: p.left, bottom: "8%",
          width: `${p.size}px`, height: `${p.size}px`,
          background: "#00D4FF",
          boxShadow: `0 0 ${p.size * 3}px rgba(0,212,255,0.8)`,
          animation: `floatUp ${p.dur} ease-in-out ${p.delay} infinite`,
          opacity: 0,
        }} />
      ))}

      {/* Corner accent lines */}
      {[
        { cls: "top-0 left-0", flip: "" },
        { cls: "top-0 right-0", flip: "scaleX(-1)" },
        { cls: "bottom-0 left-0", flip: "scaleY(-1)" },
        { cls: "bottom-0 right-0", flip: "scale(-1,-1)" },
      ].map(({ cls, flip }, i) => (
        <svg key={i} className={`absolute ${cls} w-48 h-48 opacity-15`} viewBox="0 0 256 256" fill="none" style={{ transform: flip || undefined }}>
          <path d="M0 0 L80 0 L80 2 L2 2 L2 80 L0 80 Z" fill="#00D4FF" />
          <path d="M20 0 L40 0" stroke="#00D4FF" strokeWidth="0.5" />
          <path d="M0 20 L0 40" stroke="#00D4FF" strokeWidth="0.5" />
        </svg>
      ))}

      {/* 3-D sphere (top center) — wrapper holds rotateX, inner spins */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 opacity-[0.12]" style={{ width: 160, height: 160, perspective: "400px" }}>
        <div style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d" }}>
          {/* Equatorial ring */}
          <div style={{ position: "absolute", inset: 0 }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1px dashed rgba(0,212,255,0.8)", animation: "hudSpin 12s linear infinite" }} />
          </div>
          {/* Ring tilted 60° — outer holds tilt, inner spins */}
          <div style={{ position: "absolute", inset: 0, transform: "rotateX(60deg)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1px dashed rgba(0,212,255,0.6)", animation: "hudSpin 8s linear infinite reverse" }} />
          </div>
          {/* Ring tilted -60° */}
          <div style={{ position: "absolute", inset: 0, transform: "rotateX(-60deg)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1px solid rgba(0,212,255,0.4)", animation: "hudSpin 16s linear infinite" }} />
          </div>
          {/* Polar ring */}
          <div style={{ position: "absolute", inset: "8px", transform: "rotateX(90deg)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1px dashed rgba(0,212,255,0.3)", animation: "hudSpin 5s linear infinite" }} />
          </div>
          {/* Bright arc */}
          <div style={{ position: "absolute", inset: "20px" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#00D4FF", boxShadow: "0 0 8px rgba(0,212,255,0.8)", animation: "hudSpin 3s linear infinite" }} />
          </div>
          {/* Center dot */}
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 6, height: 6, borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 10px rgba(0,212,255,1)", transform: "translate(-50%,-50%)" }} />
        </div>
      </div>

      {/* 3-D orbital cluster — bottom right */}
      <div className="absolute bottom-16 right-16 opacity-[0.07]" style={{ width: 220, height: 220, perspective: "600px" }}>
        <div style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1px dashed rgba(0,212,255,0.6)", animation: "hudSpin 22s linear infinite" }} />
          </div>
          <div style={{ position: "absolute", inset: 0, transform: "rotateX(45deg)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "0.5px solid rgba(0,212,255,0.4)", animation: "hudSpin 14s linear infinite reverse" }} />
          </div>
          <div style={{ position: "absolute", inset: "20px", transform: "rotateX(70deg)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "0.5px dashed rgba(255,107,53,0.5)", animation: "hudSpin 9s linear infinite" }} />
          </div>
          <div style={{ position: "absolute", inset: "50px" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1px solid rgba(0,212,255,0.3)", borderTopColor: "#00D4FF", animation: "hudSpin 4s linear infinite" }} />
          </div>
        </div>
      </div>

      {/* Subtle crosshair center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04]">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <line x1="40" y1="0" x2="40" y2="28" stroke="#00D4FF" strokeWidth="0.5" />
          <line x1="40" y1="52" x2="40" y2="80" stroke="#00D4FF" strokeWidth="0.5" />
          <line x1="0" y1="40" x2="28" y2="40" stroke="#00D4FF" strokeWidth="0.5" />
          <line x1="52" y1="40" x2="80" y2="40" stroke="#00D4FF" strokeWidth="0.5" />
          <circle cx="40" cy="40" r="7" fill="none" stroke="#00D4FF" strokeWidth="0.5"
            style={{ animation: "hudSpin 4s linear infinite", transformOrigin: "40px 40px", transformBox: "fill-box" }} />
        </svg>
      </div>
    </div>
  );
}
