const BACKEND = "http://localhost:8000";

export interface RawPost {
  id: string;
  url: string;
  timestamp: string;
  caption: string;
  likes: number;
  post_url: string;
  is_carousel: boolean;
}

export interface ScrapeResult {
  username: string;
  total: number;
  posts: RawPost[];
}

export async function fetchProfile(username: string): Promise<ScrapeResult> {
  const res = await fetch(`${BACKEND}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
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
