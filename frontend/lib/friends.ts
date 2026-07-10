import type { CalendarEvent } from "./google";

export interface Friend {
  id: string;
  name: string;
  email?: string;
  source: "calendar" | "manual";
  lastSeen: string | null; // ISO date string
  daysSince: number;
  snoozedUntil?: string; // ISO date — hide from widget until this date
}

const STORAGE_KEY = "jarvis_friends_v2";

function calcDaysSince(dateStr: string | null): number {
  if (!dateStr) return 9999;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

export function extractFriendsFromEvents(events: CalendarEvent[], myEmail: string): Friend[] {
  const map = new Map<string, { name: string; lastSeen: string }>();

  for (const event of events) {
    const eventDate = event.start?.dateTime ?? event.start?.date ?? "";
    if (!eventDate) continue;

    const attendees = event.attendees ?? [];
    for (const a of attendees) {
      if (a.self) continue;
      if (!a.email) continue;
      if (a.email.toLowerCase() === myEmail.toLowerCase()) continue;
      // Skip system/bot addresses
      if (
        a.email.includes("calendar.google.com") ||
        a.email.includes("group.calendar") ||
        a.email.includes("resource.calendar") ||
        a.email.endsWith(".gserviceaccount.com")
      ) continue;

      const existing = map.get(a.email);
      if (!existing || new Date(eventDate) > new Date(existing.lastSeen)) {
        map.set(a.email, {
          name: a.displayName ?? a.email.split("@")[0].replace(/[._]/g, " "),
          lastSeen: eventDate,
        });
      }
    }
  }

  return Array.from(map.entries()).map(([email, data]) => ({
    id: email,
    name: capitalize(data.name),
    email,
    source: "calendar" as const,
    lastSeen: data.lastSeen,
    daysSince: calcDaysSince(data.lastSeen),
  }));
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

export function loadFriends(): Friend[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const friends: Friend[] = JSON.parse(raw);
    // Recalculate daysSince on load (it changes daily)
    return friends.map(f => ({ ...f, daysSince: calcDaysSince(f.lastSeen) }));
  } catch { return []; }
}

export function saveFriends(friends: Friend[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(friends));
}

export function mergeFriends(existing: Friend[], extracted: Friend[]): Friend[] {
  const map = new Map(existing.map(f => [f.id, f]));

  for (const f of extracted) {
    const ex = map.get(f.id);
    if (!ex) {
      map.set(f.id, f);
    } else if (f.lastSeen && (!ex.lastSeen || new Date(f.lastSeen) > new Date(ex.lastSeen))) {
      map.set(f.id, { ...ex, lastSeen: f.lastSeen, daysSince: f.daysSince });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.daysSince - a.daysSince);
}

export function addManualFriend(name: string): Friend {
  return {
    id: `manual_${Date.now()}`,
    name: capitalize(name.trim()),
    source: "manual",
    lastSeen: null,
    daysSince: 9999,
  };
}

export function snoozeFriend(friend: Friend, days = 7): Friend {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return { ...friend, snoozedUntil: until.toISOString() };
}

export function markContacted(friend: Friend): Friend {
  const now = new Date().toISOString();
  return { ...friend, lastSeen: now, daysSince: 0, snoozedUntil: undefined };
}

export function isVisible(friend: Friend): boolean {
  if (!friend.snoozedUntil) return true;
  return new Date() > new Date(friend.snoozedUntil);
}
