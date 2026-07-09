"use client";

interface Props {
  current: number;
  total: number;
  status: string;
  found: number;
}

export default function ScanProgress({ current, total, status, found }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* HUD ring */}
      <div className="flex justify-center">
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144">
            {/* Track */}
            <circle cx="72" cy="72" r="60" fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="6" />
            {/* Progress */}
            <circle
              cx="72"
              cy="72"
              r="60"
              fill="none"
              stroke="#00D4FF"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 60}`}
              strokeDashoffset={`${2 * Math.PI * 60 * (1 - pct / 100)}`}
              style={{
                transition: "stroke-dashoffset 0.3s ease",
                filter: "drop-shadow(0 0 6px rgba(0,212,255,0.8))",
              }}
            />
            {/* Outer ring */}
            <circle
              cx="72"
              cy="72"
              r="68"
              fill="none"
              stroke="rgba(0,212,255,0.15)"
              strokeWidth="1"
              strokeDasharray="4 6"
              style={{ animation: "hudSpin 10s linear infinite", transformOrigin: "72px 72px", transformBox: "fill-box" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="glow-cyan text-2xl font-bold tabular-nums">{pct}%</span>
            <span className="text-jarvis-text text-xs opacity-60 mt-1">ANALYZED</span>
          </div>
        </div>
      </div>

      {/* Status line */}
      <div className="text-center">
        <p className="text-cyan-jarvis text-sm tracking-widest animate-pulse">{status}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 text-center">
        {[
          { label: "SCANNED", value: `${current}/${total}` },
          { label: "SUBJECTS FOUND", value: found },
          { label: "REMAINING", value: Math.max(0, total - current) },
        ].map(({ label, value }) => (
          <div key={label} className="border-glow p-3 rounded">
            <div className="glow-cyan text-lg font-bold tabular-nums">{value}</div>
            <div className="text-jarvis-text text-xs opacity-50 mt-1 tracking-widest">{label}</div>
          </div>
        ))}
      </div>

      {/* Bar */}
      <div className="h-1 w-full bg-white/5 rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, rgba(0,212,255,0.5), #00D4FF)",
            boxShadow: "0 0 10px rgba(0,212,255,0.6)",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
