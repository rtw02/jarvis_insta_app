"use client";

interface Props {
  appearances: number;
  totalScanned: number;
  bestPhotoUrl: string;
}

export default function SubjectProfile({ appearances, totalScanned, bestPhotoUrl }: Props) {
  const pct = Math.round((appearances / totalScanned) * 100);

  return (
    <div
      className="border-glow-active rounded-lg p-4 mb-8 animate-fade-up"
      style={{ background: "rgba(0,212,255,0.03)" }}
    >
      <div className="flex items-center gap-6">
        {/* Face thumbnail */}
        <div className="relative flex-shrink-0">
          <div
            className="w-16 h-16 rounded-full overflow-hidden"
            style={{ border: "2px solid #00D4FF", boxShadow: "0 0 16px rgba(0,212,255,0.4)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bestPhotoUrl} alt="Primary subject" className="w-full h-full object-cover" />
          </div>
          {/* Spinning ring */}
          <svg className="absolute -inset-1 w-[72px] h-[72px]" viewBox="0 0 72 72">
            <circle
              cx="36" cy="36" r="34"
              fill="none" stroke="#00D4FF" strokeWidth="1"
              strokeDasharray="6 4" opacity="0.4"
              style={{ animation: "hudSpin 6s linear infinite", transformOrigin: "36px 36px", transformBox: "fill-box" }}
            />
          </svg>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <span className="glow-cyan text-xs font-bold tracking-[0.3em]">PRIMARY SUBJECT IDENTIFIED</span>
            <span
              className="text-xs px-2 py-0.5 rounded font-bold"
              style={{ backgroundColor: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.4)", color: "#00D4FF" }}
            >
              CONFIRMED
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
            <div>
              <span className="text-jarvis-text opacity-50">APPEARANCES </span>
              <span className="glow-cyan font-bold">{appearances}</span>
              <span className="text-jarvis-text opacity-30"> / {totalScanned} POSTS</span>
            </div>
            <div>
              <span className="text-jarvis-text opacity-50">FREQUENCY </span>
              <span className="glow-cyan font-bold">{pct}%</span>
            </div>
          </div>

          {/* Frequency bar */}
          <div className="h-1 w-full bg-white/5 rounded overflow-hidden">
            <div
              className="h-full rounded"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, rgba(0,212,255,0.5), #00D4FF)",
                boxShadow: "0 0 8px rgba(0,212,255,0.6)",
                transition: "width 1s ease",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
