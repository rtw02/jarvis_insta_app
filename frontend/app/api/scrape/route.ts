import { NextRequest, NextResponse } from "next/server";

const APIFY_TOKEN = process.env.APIFY_TOKEN ?? "";
const ACTOR = "apify~instagram-scraper";

function cutoffDate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

async function startRun(username: string, days: number): Promise<{ runId: string; datasetId: string }> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${APIFY_TOKEN}&waitForFinish=0`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: "posts",
        resultsLimit: 300,
        onlyPostsNewerThan: cutoffDate(days),
      }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  const { data } = await res.json();
  return { runId: data.id, datasetId: data.defaultDatasetId };
}

export async function POST(req: NextRequest) {
  if (!APIFY_TOKEN) return NextResponse.json({ error: "APIFY_TOKEN not set" }, { status: 500 });

  const { username } = await req.json();
  if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 });

  try {
    const { runId, datasetId } = await startRun(username, 365); // 1 year
    return NextResponse.json({ runId, datasetId, username });
  } catch (e) {
    return NextResponse.json({ error: `Apify error: ${String(e).slice(0, 200)}` }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  if (!APIFY_TOKEN) return NextResponse.json({ error: "APIFY_TOKEN not set" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  const datasetId = searchParams.get("datasetId");
  const username = searchParams.get("username") ?? "";

  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
  const { data } = await statusRes.json();

  if (data.status === "RUNNING" || data.status === "READY") {
    return NextResponse.json({ status: "running" });
  }

  if (data.status !== "SUCCEEDED") {
    return NextResponse.json({ status: "failed", error: data.status }, { status: 502 });
  }

  const dsId = datasetId || data.defaultDatasetId;
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&format=json`
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = await itemsRes.json();

  const posts = items
    .map(item => ({
      id: item.shortCode || item.id || String(Math.random()),
      url: item.displayUrl || item.imageUrl || "",
      timestamp: item.timestamp || new Date().toISOString(),
      caption: (item.caption || item.alt || "").slice(0, 200),
      likes: item.likesCount || item.likes || 0,
      post_url: item.url || `https://www.instagram.com/p/${item.shortCode}/`,
      is_carousel: item.type === "Sidecar",
      is_video: item.isVideo || item.type === "Video",
    }))
    .filter(p => p.url);

  return NextResponse.json({
    status: "succeeded",
    posts,
    profile_pic_url: items[0]?.ownerProfilePicUrl ?? null,
    username: items[0]?.ownerUsername ?? "",
    total: posts.length,
  });
}
