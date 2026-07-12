"use client";

import { useEffect, useState } from "react";

interface WeatherData {
  temp: number;
  feelsLike: number;
  tempMax: number;
  tempMin: number;
  condition: string;
  symbol: string;
  windSpeed: number;
  windDir: number;
  humidity: number;
  precipProb: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
}

const WMO: Record<number, { label: string; symbol: string }> = {
  0:  { label: "CLEAR",          symbol: "◎" },
  1:  { label: "MAINLY CLEAR",   symbol: "◑" },
  2:  { label: "PARTLY CLOUDY",  symbol: "◐" },
  3:  { label: "OVERCAST",       symbol: "▦" },
  45: { label: "FOG",            symbol: "≈" },
  48: { label: "ICING FOG",      symbol: "≈" },
  51: { label: "LIGHT DRIZZLE",  symbol: "↓" },
  53: { label: "DRIZZLE",        symbol: "↓" },
  55: { label: "HEAVY DRIZZLE",  symbol: "↓" },
  61: { label: "LIGHT RAIN",     symbol: "⋮" },
  63: { label: "RAIN",           symbol: "⋮" },
  65: { label: "HEAVY RAIN",     symbol: "⋮" },
  71: { label: "LIGHT SNOW",     symbol: "✦" },
  73: { label: "SNOW",           symbol: "✦" },
  75: { label: "HEAVY SNOW",     symbol: "✦" },
  80: { label: "RAIN SHOWERS",   symbol: "⋮" },
  81: { label: "SHOWERS",        symbol: "⋮" },
  82: { label: "HEAVY SHOWERS",  symbol: "⋮" },
  95: { label: "THUNDERSTORM",   symbol: "⚡" },
  96: { label: "THUNDERSTORM",   symbol: "⚡" },
  99: { label: "THUNDERSTORM",   symbol: "⚡" },
};

function wmoLabel(code: number) {
  if (WMO[code]) return WMO[code];
  const keys = Object.keys(WMO).map(Number).sort((a, b) => a - b);
  const closest = keys.reduce((prev, k) => Math.abs(k - code) < Math.abs(prev - code) ? k : prev, keys[0]);
  return WMO[closest] ?? { label: "UNKNOWN", symbol: "?" };
}

function windDirLabel(deg: number): string {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function uvLabel(uv: number): string {
  if (uv <= 2) return "LOW";
  if (uv <= 5) return "MOD";
  if (uv <= 7) return "HIGH";
  if (uv <= 10) return "V.HI";
  return "EXTR";
}

function uvColor(uv: number): string {
  if (uv <= 2) return "#00FF88";
  if (uv <= 5) return "#FFD700";
  if (uv <= 7) return "#FF6B35";
  return "#FF3355";
}

// ── SVG math helpers ────────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// ── Temperature ring gauge ───────────────────────────────────────────────────

function TempRing({ temp, min, max }: { temp: number; min: number; max: number }) {
  const sz = 90, cx = sz / 2, cy = sz / 2, r = 38;
  const pct = Math.max(0, Math.min(1, (temp - min) / Math.max(1, max - min)));
  const START = 135, TOTAL = 270;

  const minPt = polar(cx, cy, r, START);
  const maxPt = polar(cx, cy, r, START + TOTAL);

  return (
    <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ overflow: "visible" }}>
      <defs>
        <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="arc-grad" gradientUnits="userSpaceOnUse"
          x1={polar(cx, cy, r, START).x} y1={polar(cx, cy, r, START).y}
          x2={polar(cx, cy, r, START + TOTAL).x} y2={polar(cx, cy, r, START + TOTAL).y}>
          <stop offset="0%" stopColor="#0088FF" />
          <stop offset="100%" stopColor="#FF6B35" />
        </linearGradient>
      </defs>
      {/* Background track */}
      <path d={arcPath(cx, cy, r, START, TOTAL)} fill="none"
        stroke="rgba(0,212,255,0.1)" strokeWidth="5" strokeLinecap="round" />
      {/* Filled portion */}
      {pct > 0.01 && (
        <path d={arcPath(cx, cy, r, START, TOTAL * pct)} fill="none"
          stroke="url(#arc-grad)" strokeWidth="5" strokeLinecap="round"
          filter="url(#ring-glow)" />
      )}
      {/* Min/max endpoint dots */}
      <circle cx={minPt.x} cy={minPt.y} r={2.5} fill="#0088FF" opacity={0.5} />
      <circle cx={maxPt.x} cy={maxPt.y} r={2.5} fill="#FF6B35" opacity={0.5} />
      {/* Min / max labels */}
      <text x={minPt.x - 3} y={minPt.y + 12} textAnchor="middle"
        fill="rgba(0,136,255,0.45)" fontSize="7.5" fontFamily="Space Mono,monospace">{min}°</text>
      <text x={maxPt.x + 3} y={maxPt.y + 12} textAnchor="middle"
        fill="rgba(255,107,53,0.45)" fontSize="7.5" fontFamily="Space Mono,monospace">{max}°</text>
    </svg>
  );
}

// ── Sun arc ──────────────────────────────────────────────────────────────────

function SunArc({ sunrise, sunset }: { sunrise: string; sunset: string }) {
  const W = 260, H = 78;
  const cx = W / 2, cy = H - 2;
  const r = (W - 52) / 2;

  const sr = new Date(sunrise).getTime();
  const ss = new Date(sunset).getTime();
  const now = Date.now();
  const t = Math.max(0, Math.min(1, (now - sr) / (ss - sr)));
  const isDay = now >= sr && now <= ss;

  const x1 = cx - r, x2 = cx + r;
  const fullArc = `M ${x1} ${cy} A ${r} ${r} 0 0 1 ${x2} ${cy}`;

  // Dot travels left→right as t 0→1
  const angle = Math.PI * (1 - t);
  const dotX = cx + r * Math.cos(angle);
  const dotY = cy - r * Math.sin(angle);
  const fillArc = isDay
    ? `M ${x1} ${cy} A ${r} ${r} 0 0 1 ${dotX.toFixed(2)} ${dotY.toFixed(2)}`
    : now > ss ? fullArc : "";

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ height: H, overflow: "visible" }}>
      <defs>
        <filter id="sdot-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="ground-fade" cx="50%" cy="0%" r="50%">
          <stop offset="0%" stopColor="rgba(0,212,255,0.06)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Ground plane gradient for depth */}
      <rect x={x1} y={cy} width={r * 2} height={14} fill="url(#ground-fade)" />

      {/* Background arc (dashed) */}
      <path d={fullArc} fill="none" stroke="rgba(0,212,255,0.13)" strokeWidth="1"
        strokeDasharray="4 5" />

      {/* Progress arc */}
      {fillArc && (
        <path d={fillArc} fill="none" stroke="rgba(255,200,50,0.5)"
          strokeWidth="1.5" strokeLinecap="round" />
      )}

      {/* Horizon line */}
      <line x1={x1 - 8} y1={cy} x2={x2 + 8} y2={cy}
        stroke="rgba(0,212,255,0.12)" strokeWidth="0.5" />

      {/* Sunrise / sunset endpoint dots */}
      <circle cx={x1} cy={cy} r={2.5} fill="rgba(255,200,50,0.35)" />
      <circle cx={x2} cy={cy} r={2.5} fill="rgba(255,107,53,0.35)" />

      {/* Sun dot */}
      {isDay && (
        <>
          <circle cx={dotX} cy={dotY} r={10} fill="rgba(255,200,50,0.07)" />
          <circle cx={dotX} cy={dotY} r={4} fill="#FFD032" filter="url(#sdot-glow)" />
          <text x={dotX} y={dotY - 13} textAnchor="middle"
            fill="rgba(255,200,50,0.55)" fontSize="7.5" fontFamily="Space Mono,monospace">
            {Math.round(t * 100)}%
          </text>
        </>
      )}

      {/* Labels */}
      <text x={x1} y={cy - 7} textAnchor="middle"
        fill="rgba(0,212,255,0.3)" fontSize="7.5" fontFamily="Space Mono,monospace">
        {fmtTime(sunrise)}
      </text>
      <text x={x2} y={cy - 7} textAnchor="middle"
        fill="rgba(0,212,255,0.3)" fontSize="7.5" fontFamily="Space Mono,monospace">
        {fmtTime(sunset)}
      </text>
    </svg>
  );
}

// ── Wind compass (CSS 3D perspective tilt) ───────────────────────────────────

function WindCompass({ direction }: { direction: number }) {
  const sz = 64, cx = sz / 2, cy = sz / 2, r = 27;

  // Convert compass degrees (0=N, clockwise) → SVG angle (0=right, clockwise)
  const svgRad = (direction - 90) * (Math.PI / 180);
  const tipX  = cx + (r - 5) * Math.cos(svgRad);
  const tipY  = cy + (r - 5) * Math.sin(svgRad);
  const tailX = cx - 9 * Math.cos(svgRad);
  const tailY = cy - 9 * Math.sin(svgRad);

  const ticks = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    // CSS perspective tilt gives 3D coin/disc appearance
    <div style={{ perspective: "160px", flexShrink: 0 }}>
      <div style={{ transform: "rotateX(22deg)", transformStyle: "preserve-3d" }}>
        <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ overflow: "visible" }}>
          <defs>
            <filter id="cmp-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Disc shadow (3D depth illusion) */}
          <ellipse cx={cx} cy={cy + 3} rx={r + 1} ry={4}
            fill="rgba(0,212,255,0.04)" />

          {/* Outer ring */}
          <circle cx={cx} cy={cy} r={r} fill="rgba(0,212,255,0.04)"
            stroke="rgba(0,212,255,0.2)" strokeWidth="1" />
          {/* Inner ring */}
          <circle cx={cx} cy={cy} r={r * 0.55} fill="none"
            stroke="rgba(0,212,255,0.07)" strokeWidth="0.5" strokeDasharray="2 3" />

          {/* Tick marks */}
          {ticks.map(d => {
            const rad = (d - 90) * (Math.PI / 180);
            const inner = d % 90 === 0 ? r - 7 : r - 3;
            return (
              <line key={d}
                x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)}
                x2={cx + r * Math.cos(rad)} y2={cy + r * Math.sin(rad)}
                stroke={d % 90 === 0 ? "rgba(0,212,255,0.35)" : "rgba(0,212,255,0.1)"}
                strokeWidth={d % 90 === 0 ? 1.5 : 0.5} />
            );
          })}

          {/* N label (orange accent) */}
          <text x={cx} y={cy - r + 10} textAnchor="middle"
            fill="rgba(255,107,53,0.65)" fontSize="7.5"
            fontFamily="Space Mono,monospace" fontWeight="bold">N</text>

          {/* Wind arrow */}
          <line x1={tailX} y1={tailY} x2={tipX} y2={tipY}
            stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round"
            filter="url(#cmp-glow)" />
          {/* Arrowhead dot */}
          <circle cx={tipX} cy={tipY} r={2.5} fill="#00D4FF" filter="url(#cmp-glow)" />
          {/* Center pivot */}
          <circle cx={cx} cy={cy} r={2} fill="rgba(0,212,255,0.45)" />
        </svg>
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`
          );
          if (!res.ok) throw new Error("Weather fetch failed");
          const data = await res.json();
          const meta = wmoLabel(data.current.weather_code);
          setWeather({
            temp:       Math.round(data.current.temperature_2m),
            feelsLike:  Math.round(data.current.apparent_temperature),
            tempMax:    Math.round(data.daily.temperature_2m_max[0]),
            tempMin:    Math.round(data.daily.temperature_2m_min[0]),
            condition:  meta.label,
            symbol:     meta.symbol,
            windSpeed:  Math.round(data.current.wind_speed_10m),
            windDir:    data.current.wind_direction_10m,
            humidity:   data.current.relative_humidity_2m,
            precipProb: data.daily.precipitation_probability_max[0] ?? 0,
            uvIndex:    Math.round(data.daily.uv_index_max[0] ?? 0),
            sunrise:    data.daily.sunrise[0],
            sunset:     data.daily.sunset[0],
          });
        } catch {
          setError("WEATHER UNAVAILABLE");
        } finally {
          setLoading(false);
        }
      },
      () => { setError("LOCATION DENIED"); setLoading(false); }
    );
  }, []);

  return (
    <div className="border-glow rounded-lg p-4 h-full font-mono" style={{ background: "rgba(0,212,255,0.02)" }}>
      <div className="text-cyan-jarvis opacity-40 text-xs tracking-widest mb-2">// ATMOSPHERIC CONDITIONS</div>

      {loading && <div className="text-xs text-jarvis-text opacity-40 animate-pulse tracking-widest">LOCATING...</div>}
      {error   && <div className="text-xs tracking-widest opacity-40" style={{ color: "#FF6B35" }}>{error}</div>}

      {weather && (
        <div className="space-y-3">

          {/* Sun arc — day progress visualization */}
          <SunArc sunrise={weather.sunrise} sunset={weather.sunset} />

          {/* Temp ring gauge + condition + wind compass */}
          <div className="flex items-center gap-3">
            {/* Temp ring */}
            <div className="relative flex-shrink-0" style={{ width: 90, height: 90 }}>
              <TempRing temp={weather.temp} min={weather.tempMin} max={weather.tempMax} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold glow-cyan" style={{ lineHeight: 1 }}>{weather.temp}°</div>
                <div className="text-[9px] opacity-30 tracking-widest mt-0.5">FEELS {weather.feelsLike}°</div>
              </div>
            </div>

            {/* Condition */}
            <div className="flex-1 min-w-0">
              <div className="text-3xl">{weather.symbol}</div>
              <div className="text-xs tracking-widest opacity-60 mt-0.5">{weather.condition}</div>
              <div className="text-[10px] opacity-30 tracking-widest mt-1.5">
                HI {weather.tempMax}° &nbsp;/&nbsp; LO {weather.tempMin}°
              </div>
            </div>

            {/* Wind compass */}
            <WindCompass direction={weather.windDir} />
          </div>

          {/* Humidity + precip bars */}
          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-jarvis-border/20">
            {[
              { label: "HUMIDITY", val: weather.humidity, color: "rgba(0,212,255,0.4)" },
              { label: "PRECIP",   val: weather.precipProb, color: "rgba(0,160,255,0.5)" },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span className="text-jarvis-text opacity-40 tracking-widest">{label}</span>
                  <span className="text-jarvis-text opacity-60">{val}%</span>
                </div>
                <div className="h-0.5 bg-white/5 rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${val}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Wind speed / UV */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <div className="text-jarvis-text opacity-40 tracking-widest mb-0.5">WIND</div>
              <div className="text-jarvis-text font-bold">
                {weather.windSpeed} mph <span className="opacity-50">{windDirLabel(weather.windDir)}</span>
              </div>
            </div>
            <div>
              <div className="text-jarvis-text opacity-40 tracking-widest mb-0.5">UV INDEX</div>
              <div className="font-bold" style={{ color: uvColor(weather.uvIndex) }}>
                {weather.uvIndex} <span className="text-[10px]">{uvLabel(weather.uvIndex)}</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
