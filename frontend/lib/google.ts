export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  attendees?: { email: string; displayName?: string; self?: boolean }[];
  organizer?: { email: string; displayName?: string; self?: boolean };
}

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

const SCOPES = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
const TOKEN_KEY = "jarvis_google_token";

export function saveToken(token: string): void {
  const expiry = Date.now() + 3500 * 1000; // ~58 min (tokens last 1hr)
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiry }));
}

export function loadToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) return null;
    return token;
  } catch { return null; }
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>)["google"]) { resolve(); return; }
    if (document.getElementById("google-gsi")) {
      const check = setInterval(() => {
        if ((window as unknown as Record<string, unknown>)["google"]) { clearInterval(check); resolve(); }
      }, 100);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

// Gate auth: uses accounts.id (One Tap / Sign In With Google).
// Returns email decoded from id_token JWT — no userinfo API call needed.
export function initGateSignIn(
  clientId: string,
  onSuccess: (email: string) => void,
  onError: (msg: string) => void,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const google = (window as any).google;
  if (!google?.accounts?.id) { onError("Google SDK not loaded"); return; }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: (response: { credential?: string }) => {
      if (!response.credential) { onError("No credential returned"); return; }
      try {
        const payload = JSON.parse(atob(response.credential.split(".")[1]));
        onSuccess(payload.email ?? "");
      } catch {
        onError("Failed to decode credential");
      }
    },
    auto_select: false,
    cancel_on_tap_outside: false,
  });
}

export function renderGoogleButton(el: HTMLElement): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const google = (window as any).google;
  google?.accounts?.id?.renderButton(el, {
    theme: "filled_black", size: "large", text: "signin_with", logo_alignment: "left",
  });
}

export function requestGoogleToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!google) { reject(new Error("Google not loaded")); return; }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: { error?: string; access_token?: string }) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "Token request failed"));
        } else {
          resolve(response.access_token);
        }
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export async function fetchUserInfo(accessToken: string): Promise<GoogleUser> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Userinfo failed: ${res.status}`);
  return res.json();
}

interface CalendarMeta { id: string; summary: string }

async function fetchCalendarList(accessToken: string): Promise<CalendarMeta[]> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [{ id: "primary", summary: "primary" }];
  const data = await res.json();
  return (data.items ?? []) as CalendarMeta[];
}

async function fetchCalendarIds(accessToken: string, excludeNames: string[] = []): Promise<string[]> {
  const list = await fetchCalendarList(accessToken);
  const excluded = excludeNames.map(n => n.toLowerCase());
  return list
    .filter(c => !excluded.some(ex => c.summary?.toLowerCase().includes(ex)))
    .map(c => c.id);
}

async function fetchEventsFromCalendar(
  accessToken: string,
  calendarId: string,
  params: URLSearchParams
): Promise<CalendarEvent[]> {
  const encoded = encodeURIComponent(calendarId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encoded}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as CalendarEvent[];
}

export async function fetchTodayEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const calendarIds = await fetchCalendarIds(accessToken);
  const results = await Promise.all(
    calendarIds.map(id => fetchEventsFromCalendar(accessToken, id, params))
  );

  const all = results
    .flat()
    // Drop all-day events (they have only .date, not .dateTime)
    .filter(e => !!e.start?.dateTime);

  all.sort((a, b) => {
    const ta = a.start?.dateTime ?? "";
    const tb = b.start?.dateTime ?? "";
    return ta.localeCompare(tb);
  });
  return all;
}

// excludeCalendarNames: calendar summaries to skip (case-insensitive substring match)
export async function fetchRecentEvents(
  accessToken: string,
  days = 90,
  excludeCalendarNames: string[] = ["work"]
): Promise<CalendarEvent[]> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: now.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });

  const calendarIds = await fetchCalendarIds(accessToken, excludeCalendarNames);
  const results = await Promise.all(
    calendarIds.map(id => fetchEventsFromCalendar(accessToken, id, params))
  );
  return results.flat();
}
