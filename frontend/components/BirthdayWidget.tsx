"use client";

import { useEffect, useState } from "react";

interface Birthday {
  name: string;
  days_until: number;
  age: number | null;
}

export default function BirthdayWidget() {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/birthdays?days=90")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.birthdays) setBirthdays(d.birthdays); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && birthdays.length === 0) return null;

  return (
    <div className="border-glow rounded-lg p-4 font-mono text-xs" style={{ background: "rgba(255,107,53,0.02)" }}>
      <div className="tracking-widest mb-3" style={{ color: "#FF6B35", opacity: 0.5 }}>// UPCOMING BIRTHDAYS</div>

      {loading && (
        <div className="text-jarvis-text opacity-30 tracking-widest animate-pulse">LOADING...</div>
      )}

      {!loading && birthdays.map((b, i) => {
        const isToday = b.days_until === 0;
        const isTomorrow = b.days_until === 1;
        const when = isToday ? "TODAY" : isTomorrow ? "TOMORROW" : `IN ${b.days_until} DAYS`;
        const nameColor = isToday ? "#FF6B35" : "rgba(255,255,255,0.8)";
        const whenColor = isToday ? "#FF6B35" : isTomorrow ? "rgba(255,107,53,0.7)" : "rgba(255,255,255,0.3)";

        return (
          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0"
            style={{ borderColor: "rgba(255,107,53,0.08)" }}>
            <div className="space-y-0.5">
              <div className="font-bold" style={{ color: nameColor }}>{b.name}</div>
              {b.age !== null && (
                <div className="opacity-30" style={{ color: "rgba(255,255,255,0.5)" }}>
                  turns {b.age}
                </div>
              )}
            </div>
            <div className="tracking-widest font-bold" style={{ color: whenColor }}>
              {when}
            </div>
          </div>
        );
      })}
    </div>
  );
}
