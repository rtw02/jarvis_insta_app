"use client";

import { useState } from "react";
import type { ScoredPost } from "@/lib/scoring";
import { SUBJECT_LABELS, SUBJECT_COLORS } from "@/lib/scoring";

interface Props {
  post: ScoredPost;
  rank: number;
  style?: React.CSSProperties;
}

export default function DossierCard({ post, rank, style }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const [scanning, setScanning] = useState(true);
  const color = SUBJECT_COLORS[post.subjectType];
  const label = SUBJECT_LABELS[post.subjectType];
  const date = new Date(post.timestamp).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
  const confidence = Math.min(99, Math.round(post.score)).toString().padStart(2, "0");

  return (
    <div
      className="dossier-card rounded-lg overflow-hidden animate-fade-up"
      style={style}
    >
      {/* Priority badge */}
      <div
        className="flex items-center justify-between px-3 py-2 text-xs tracking-widest"
        style={{ borderBottom: `1px solid ${color}22` }}
      >
        <span style={{ color }} className="font-bold">
          PRIORITY {String(rank).padStart(2, "0")}
        </span>
        <span
          className="px-2 py-0.5 rounded text-black text-xs font-bold"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      </div>

      {/* Image */}
      <div className="relative aspect-square bg-black scan-container">
        {!imgErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.proxiedUrl}
            alt={`Priority ${rank}`}
            className="w-full h-full object-cover"
            onLoad={() => setTimeout(() => setScanning(false), 1800)}
            onError={() => { setImgErr(true); setScanning(false); }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-jarvis-text opacity-30">
            IMAGE UNAVAILABLE
          </div>
        )}

        {/* Scan line overlay */}
        {scanning && <div className="scan-line" />}

        {/* Face area indicator */}
        {post.faceCount > 0 && !scanning && (
          <div
            className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-bold"
            style={{ backgroundColor: `${color}33`, border: `1px solid ${color}66`, color }}
          >
            ◉ {post.faceCount} FACE{post.faceCount > 1 ? "S" : ""}
          </div>
        )}

        {/* Reel badge */}
        {post.is_video && !scanning && (
          <div
            className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded font-bold"
            style={{ backgroundColor: "rgba(255,107,53,0.25)", border: "1px solid rgba(255,107,53,0.5)", color: "#FF6B35" }}
          >
            ▶ REEL
          </div>
        )}

        {/* Corner brackets on hover */}
        <div className="absolute top-1 left-1 w-3 h-3 border-t border-l opacity-60" style={{ borderColor: color }} />
        <div className="absolute top-1 right-1 w-3 h-3 border-t border-r opacity-60" style={{ borderColor: color }} />
        <div className="absolute bottom-1 left-1 w-3 h-3 border-b border-l opacity-60" style={{ borderColor: color }} />
        <div className="absolute bottom-1 right-1 w-3 h-3 border-b border-r opacity-60" style={{ borderColor: color }} />
      </div>

      {/* Metadata */}
      <div className="p-3 space-y-2 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-jarvis-text opacity-50">CONFIDENCE</span>
          <span style={{ color }} className="font-bold">{confidence}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-jarvis-text opacity-50">COVERAGE</span>
          <span className="text-jarvis-text">{post.faceAreaPct.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-jarvis-text opacity-50">DATE</span>
          <span className="text-jarvis-text">{date}</span>
        </div>
        {post.likes > 0 && (
          <div className="flex justify-between">
            <span className="text-jarvis-text opacity-50">LIKES</span>
            <span className="text-jarvis-text">{post.likes.toLocaleString()}</span>
          </div>
        )}

        {/* Score bar */}
        <div className="pt-1">
          <div className="h-px w-full bg-white/5 rounded overflow-hidden">
            <div
              className="h-full rounded"
              style={{
                width: `${Math.min(100, post.score)}%`,
                backgroundColor: color,
                boxShadow: `0 0 6px ${color}`,
                transition: "width 0.8s ease",
              }}
            />
          </div>
        </div>

        {/* Link */}
        <a
          href={post.post_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center pt-1 tracking-widest opacity-40 hover:opacity-80 transition-opacity"
          style={{ color }}
        >
          VIEW POST →
        </a>
      </div>
    </div>
  );
}
