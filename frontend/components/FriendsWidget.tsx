"use client";

import { useState } from "react";
import type { Friend } from "@/lib/friends";
import { addManualFriend, snoozeFriend, markContacted, isVisible } from "@/lib/friends";

interface Props {
  friends: Friend[];
  onChange: (friends: Friend[]) => void;
}

function urgencyColor(days: number): string {
  if (days >= 60) return "#FF6B35";
  if (days >= 30) return "#FFB347";
  return "#00D4FF";
}

function urgencyLabel(days: number): string {
  if (days >= 9000) return "NEVER";
  if (days >= 60) return `${days}D AGO`;
  if (days >= 30) return `${days}D AGO`;
  return `${days}D AGO`;
}

export default function FriendsWidget({ friends, onChange }: Props) {
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const visible = friends.filter(isVisible).slice(0, 8);

  function handleAdd() {
    if (!newName.trim()) return;
    const f = addManualFriend(newName);
    onChange([f, ...friends]);
    setNewName("");
    setShowAdd(false);
  }

  function handleSnooze(id: string) {
    onChange(friends.map(f => f.id === id ? snoozeFriend(f, 7) : f));
  }

  function handleContacted(id: string) {
    onChange(friends.map(f => f.id === id ? markContacted(f) : f));
  }

  return (
    <div className="border-glow rounded-lg p-4 h-full" style={{ background: "rgba(0,212,255,0.02)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-cyan-jarvis opacity-40 text-xs tracking-widest font-mono">// CHECK IN WITH</div>
        <button
          onClick={() => setShowAdd(s => !s)}
          className="text-xs font-mono tracking-widest opacity-40 hover:opacity-80 transition-opacity"
          style={{ color: "#00D4FF" }}
        >
          + ADD
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2 mb-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="NAME"
            className="jarvis-input flex-1 px-3 py-1.5 text-xs tracking-widest uppercase"
            autoFocus
          />
          <button onClick={handleAdd} className="jarvis-btn px-3 py-1.5 text-xs tracking-widest">
            ADD
          </button>
        </div>
      )}

      {visible.length === 0 && (
        <div className="text-xs text-jarvis-text opacity-30 tracking-widest">
          {friends.length === 0 ? "SYNC CALENDAR TO EXTRACT CONTACTS" : "ALL CAUGHT UP"}
        </div>
      )}

      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "280px" }}>
        {visible.map((f) => (
          <div key={f.id} className="flex items-center gap-3 group rounded p-1.5 hover:bg-white/3 transition-all">
            {/* Status dot */}
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: urgencyColor(f.daysSince), boxShadow: `0 0 4px ${urgencyColor(f.daysSince)}` }} />

            {/* Name + source */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono truncate" style={{ color: "#fff" }}>{f.name}</div>
              {f.source === "calendar" && (
                <div className="text-jarvis-text opacity-25" style={{ fontSize: "10px" }}>CALENDAR</div>
              )}
            </div>

            {/* Days since */}
            <div className="text-right flex-shrink-0">
              <div className="text-xs font-mono font-bold" style={{ color: urgencyColor(f.daysSince) }}>
                {urgencyLabel(f.daysSince)}
              </div>
            </div>

            {/* Actions — reveal on hover */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleContacted(f.id)}
                title="Mark contacted"
                className="text-xs px-1.5 py-0.5 rounded font-mono"
                style={{ color: "#00D4FF", border: "1px solid rgba(0,212,255,0.3)" }}
              >✓</button>
              <button
                onClick={() => handleSnooze(f.id)}
                title="Snooze 7 days"
                className="text-xs px-1.5 py-0.5 rounded font-mono"
                style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
              >—</button>
            </div>
          </div>
        ))}
      </div>

      {friends.filter(isVisible).length > 8 && (
        <div className="mt-2 text-xs text-jarvis-text opacity-30 tracking-widest text-center">
          +{friends.filter(isVisible).length - 8} MORE
        </div>
      )}
    </div>
  );
}
