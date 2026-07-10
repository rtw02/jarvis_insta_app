"use client";

import { useEffect, useState } from "react";

interface WeatherData {
  temp: number;
  tempMax: number;
  tempMin: number;
  condition: string;
  symbol: string;
  windSpeed: number;
  humidity?: number;
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
  // find closest code
  if (WMO[code]) return WMO[code];
  const keys = Object.keys(WMO).map(Number).sort((a, b) => a - b);
  const closest = keys.reduce((prev, k) => Math.abs(k - code) < Math.abs(prev - code) ? k : prev, keys[0]);
  return WMO[closest] ?? { label: "UNKNOWN", symbol: "?" };
}

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
            `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
            `&daily=temperature_2m_max,temperature_2m_min` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`
          );
          if (!res.ok) throw new Error("Weather fetch failed");
          const data = await res.json();
          const code = data.current.weather_code;
          const meta = wmoLabel(code);
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            tempMax: Math.round(data.daily.temperature_2m_max[0]),
            tempMin: Math.round(data.daily.temperature_2m_min[0]),
            condition: meta.label,
            symbol: meta.symbol,
            windSpeed: Math.round(data.current.wind_speed_10m),
            humidity: data.current.relative_humidity_2m,
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
    <div className="border-glow rounded-lg p-4 h-full" style={{ background: "rgba(0,212,255,0.02)" }}>
      <div className="text-cyan-jarvis opacity-40 text-xs tracking-widest font-mono mb-3">// ATMOSPHERIC CONDITIONS</div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-jarvis-text opacity-40">
          <span className="animate-pulse">LOCATING...</span>
        </div>
      )}

      {error && (
        <div className="text-xs tracking-widest opacity-40" style={{ color: "#FF6B35" }}>{error}</div>
      )}

      {weather && (
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold glow-cyan" style={{ fontFamily: "Space Mono, monospace" }}>
              {weather.symbol}
            </span>
            <div>
              <div className="text-3xl font-bold glow-cyan" style={{ fontFamily: "Space Mono, monospace" }}>
                {weather.temp}°F
              </div>
              <div className="text-xs tracking-widest text-jarvis-text opacity-60">{weather.condition}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center pt-2 border-t border-jarvis-border/30">
            <div>
              <div className="text-jarvis-text opacity-40 tracking-widest">HI</div>
              <div className="glow-cyan font-bold">{weather.tempMax}°</div>
            </div>
            <div>
              <div className="text-jarvis-text opacity-40 tracking-widest">LO</div>
              <div className="text-jarvis-text font-bold">{weather.tempMin}°</div>
            </div>
            <div>
              <div className="text-jarvis-text opacity-40 tracking-widest">WIND</div>
              <div className="text-jarvis-text font-bold">{weather.windSpeed} mph</div>
            </div>
          </div>

          {weather.humidity !== undefined && (
            <div className="text-xs font-mono flex items-center gap-2">
              <span className="text-jarvis-text opacity-40 tracking-widest">HUMIDITY</span>
              <div className="flex-1 h-0.5 bg-white/5 rounded overflow-hidden">
                <div className="h-full rounded" style={{
                  width: `${weather.humidity}%`,
                  background: "rgba(0,212,255,0.4)"
                }} />
              </div>
              <span className="text-jarvis-text opacity-60">{weather.humidity}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
