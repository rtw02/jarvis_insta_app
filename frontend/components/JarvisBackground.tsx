"use client";

export default function JarvisBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Grid */}
      <div className="absolute inset-0 jarvis-grid opacity-60" />

      {/* Radial glow center */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,212,255,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Corner accent lines */}
      <svg
        className="absolute top-0 left-0 w-64 h-64 opacity-20"
        viewBox="0 0 256 256"
        fill="none"
      >
        <path d="M0 0 L80 0 L80 2 L2 2 L2 80 L0 80 Z" fill="#00D4FF" />
        <path d="M20 0 L40 0" stroke="#00D4FF" strokeWidth="0.5" />
        <path d="M0 20 L0 40" stroke="#00D4FF" strokeWidth="0.5" />
      </svg>
      <svg
        className="absolute top-0 right-0 w-64 h-64 opacity-20"
        viewBox="0 0 256 256"
        fill="none"
        style={{ transform: "scaleX(-1)" }}
      >
        <path d="M0 0 L80 0 L80 2 L2 2 L2 80 L0 80 Z" fill="#00D4FF" />
      </svg>
      <svg
        className="absolute bottom-0 left-0 w-64 h-64 opacity-20"
        viewBox="0 0 256 256"
        fill="none"
        style={{ transform: "scaleY(-1)" }}
      >
        <path d="M0 0 L80 0 L80 2 L2 2 L2 80 L0 80 Z" fill="#00D4FF" />
      </svg>
      <svg
        className="absolute bottom-0 right-0 w-64 h-64 opacity-20"
        viewBox="0 0 256 256"
        fill="none"
        style={{ transform: "scale(-1, -1)" }}
      >
        <path d="M0 0 L80 0 L80 2 L2 2 L2 80 L0 80 Z" fill="#00D4FF" />
      </svg>

      {/* Spinning HUD ring — top center */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 opacity-10">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#00D4FF"
            strokeWidth="0.5"
            strokeDasharray="8 4"
            style={{ animation: "hudSpin 12s linear infinite" }}
          />
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke="#00D4FF"
            strokeWidth="0.5"
            strokeDasharray="4 8"
            style={{ animation: "hudSpin 8s linear infinite reverse" }}
          />
        </svg>
      </div>
    </div>
  );
}
