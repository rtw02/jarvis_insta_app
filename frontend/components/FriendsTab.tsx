"use client";

import { useEffect, useState } from "react";

interface IMessageContact {
  contact_id: string;
  display_name: string;
  last_date: string;
  days_since: number;
  last_is_from_me: boolean;
  needs_response: boolean;
  count_90d: number;
  count_7d: number;
  is_regular: boolean;
  lapsed: boolean;
  last_preview: string;
}

function urgencyColor(days: number): string {
  if (days >= 14) return "#FF6B35";
  if (days >= 7) return "#FFB347";
  return "#00D4FF";
}

function timeAgo(days: number): string {
  if (days === 0) return "TODAY";
  if (days === 1) return "1D AGO";
  return `${days}D AGO`;
}

function ContactRow({ c, dim }: { c: IMessageContact; dim?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded transition-all hover:bg-white/3"
      style={{ opacity: dim ? 0.4 : 1 }}>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: urgencyColor(c.days_since), boxShadow: `0 0 4px ${urgencyColor(c.days_since)}` }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono font-bold truncate" style={{ color: "#fff" }}>
          {c.display_name}
        </div>
        {c.last_preview && (
          <div className="text-jarvis-text opacity-30 truncate" style={{ fontSize: "10px" }}>
            {c.last_is_from_me ? "You: " : ""}{c.last_preview}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-xs font-mono font-bold" style={{ color: urgencyColor(c.days_since) }}>
          {timeAgo(c.days_since)}
        </div>
        <div className="text-jarvis-text opacity-25" style={{ fontSize: "10px" }}>
          {c.count_90d} msgs/90d
        </div>
      </div>
    </div>
  );
}

export default function FriendsTab() {
  const [contacts, setContacts] = useState<IMessageContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/imessage");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setContacts(data.contacts);
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const needsResponse = contacts
    .filter(c => c.needs_response)
    .slice(0, 15);

  const reconnect = contacts
    .filter(c => c.lapsed && !c.needs_response)
    .sort((a, b) => b.days_since - a.days_since)
    .slice(0, 15);

  const recentActive = contacts
    .filter(c => !c.needs_response && !c.lapsed && c.days_since <= 7)
    .slice(0, 10);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-[0.3em] glow-cyan" style={{ fontFamily: "Space Mono, monospace" }}>
            COMMUNICATIONS
          </h2>
          <p className="text-jarvis-text opacity-40 text-xs tracking-widest mt-1 font-mono">
            iMESSAGE ANALYSIS · REGULAR CONTACTS
          </p>
        </div>
        <div className="text-right space-y-1">
          <button onClick={load}
            className="text-xs font-mono tracking-widest transition-opacity"
            style={{ color: "#00D4FF", opacity: loading ? 0.3 : 0.6 }}
            disabled={loading}>
            {loading ? "SCANNING..." : "↻ REFRESH"}
          </button>
          {lastRefresh && (
            <div className="text-jarvis-text opacity-25 font-mono" style={{ fontSize: "10px" }}>
              {lastRefresh.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border rounded p-4 text-xs font-mono space-y-2"
          style={{ borderColor: "rgba(255,107,53,0.3)", background: "rgba(255,107,53,0.05)", color: "#FF6B35" }}>
          <div>⚠ {error}</div>
          {error.toLowerCase().includes("full disk") && (
            <div className="opacity-70">
              Fix: System Settings → Privacy &amp; Security → Full Disk Access → add Terminal
            </div>
          )}
        </div>
      )}

      {loading && !error && (
        <div className="text-xs font-mono text-jarvis-text opacity-40 animate-pulse tracking-widest">
          READING iMESSAGE DATABASE...
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Needs Response */}
          <div className="border-glow rounded-lg p-4" style={{ background: "rgba(255,107,53,0.02)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#FF6B35" }} />
              <span className="text-xs tracking-widest font-mono" style={{ color: "#FF6B35" }}>
                NEEDS RESPONSE
              </span>
              <span className="ml-auto text-xs font-mono opacity-40" style={{ color: "#FF6B35" }}>
                {needsResponse.length}
              </span>
            </div>
            {needsResponse.length === 0 ? (
              <div className="text-xs text-jarvis-text opacity-30 tracking-widest px-3">ALL CLEAR</div>
            ) : (
              <div className="space-y-0.5">
                {needsResponse.map(c => <ContactRow key={c.contact_id} c={c} />)}
              </div>
            )}
          </div>

          {/* Reconnect — regulars who went quiet */}
          <div className="border-glow rounded-lg p-4" style={{ background: "rgba(0,212,255,0.02)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#FFB347", boxShadow: "0 0 4px #FFB347" }} />
              <span className="text-xs tracking-widest font-mono glow-cyan">RECONNECT</span>
              <span className="ml-auto text-xs font-mono opacity-40 glow-cyan">{reconnect.length}</span>
            </div>
            <div className="text-jarvis-text opacity-25 text-xs font-mono mb-3 px-3">
              Regular contacts · silent 7+ days
            </div>
            {reconnect.length === 0 ? (
              <div className="text-xs text-jarvis-text opacity-30 tracking-widest px-3">ALL CAUGHT UP</div>
            ) : (
              <div className="space-y-0.5">
                {reconnect.map(c => <ContactRow key={c.contact_id} c={c} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recently Active — context */}
      {!loading && !error && recentActive.length > 0 && (
        <div className="border-glow rounded-lg p-4" style={{ background: "rgba(0,212,255,0.01)" }}>
          <div className="text-cyan-jarvis opacity-30 text-xs tracking-widest font-mono mb-3">// RECENTLY ACTIVE</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-0.5">
            {recentActive.map(c => <ContactRow key={c.contact_id} c={c} dim />)}
          </div>
        </div>
      )}

      {/* Stats */}
      {!loading && !error && contacts.length > 0 && (
        <div className="grid grid-cols-3 gap-4 text-center text-xs font-mono">
          {[
            { label: "NEEDS RESPONSE", value: needsResponse.length, color: "#FF6B35" },
            { label: "RECONNECT", value: reconnect.length, color: "#FFB347" },
            { label: "REGULARS", value: contacts.filter(c => c.is_regular).length, color: "#00D4FF" },
          ].map(({ label, value, color }) => (
            <div key={label} className="border-glow rounded p-3">
              <div className="text-2xl font-bold" style={{ color }}>{value}</div>
              <div className="text-jarvis-text opacity-40 tracking-widest mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
