const USE_APIFY = process.env.NEXT_PUBLIC_USE_APIFY?.toLowerCase() === "true";
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

export const usingApify = USE_APIFY;

export async function fetchProfile(username: string, sessionId: string): Promise<ScrapeResult> {
  if (USE_APIFY) return fetchProfileApify(username);

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

async function fetchProfileApify(username: string): Promise<ScrapeResult> {
  const startRes = await fetch("/api/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({ error: "Failed to start scrape" }));
    throw new Error(err.error);
  }
  let { runId, datasetId } = await startRes.json();

  // Poll every 5s for up to 5 minutes (fallback run may extend time)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const pollRes = await fetch(`/api/scrape?runId=${runId}&datasetId=${datasetId}&username=${encodeURIComponent(username)}`);
    const data = await pollRes.json();
    if (data.status === "succeeded") {
      return { username, total: data.posts.length, posts: data.posts, profile_pic_url: data.profile_pic_url };
    }
    if (data.status === "failed") throw new Error(`Scrape failed: ${data.error}`);
    // API triggered fallback run — switch to new runId and keep polling
    if (data.runId) { runId = data.runId; datasetId = data.datasetId; }
  }
  throw new Error("Scrape timed out after 5 minutes");
}

export function proxyUrl(originalUrl: string): string {
  if (USE_APIFY) return `/api/proxy?url=${encodeURIComponent(originalUrl)}`;
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
