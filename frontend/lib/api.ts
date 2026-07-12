const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export interface RawPost {
  id: string;
  url: string;
  timestamp: string;
  caption: string;
  likes: number;
  post_url: string;
  is_carousel: boolean;
  is_video: boolean;
}

export interface ScrapeResult {
  username: string;
  total: number;
  posts: RawPost[];
  profile_pic_url?: string;
}

export async function fetchProfile(username: string, sessionId: string): Promise<ScrapeResult> {
  const res = await fetch(`${BACKEND}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, session_id: sessionId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Scrape failed");
  }

  return res.json();
}

export function proxyUrl(originalUrl: string): string {
  return `${BACKEND}/proxy?url=${encodeURIComponent(originalUrl)}`;
}

export async function connectInstagram(): Promise<string> {
  const res = await fetch(`${BACKEND}/auth/instagram`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Auth failed" }));
    throw new Error(err.detail || "Auth failed");
  }
  const data = await res.json();
  return data.session_id as string;
}
