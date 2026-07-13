"use client";
import { useEffect, useRef } from "react";

export default function HoloScanLine() {
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let anim: any;
    import("animejs").then((mod) => {
      const { animate } = mod;
      if (!lineRef.current) return;
      anim = animate(lineRef.current, {
        translateY: ["-2px", "100vh"],
        opacity: [0, 0.7, 0.7, 0],
        duration: 3500,
        ease: "linear",
        loop: true,
        delay: 3000,
      });
    });
    return () => anim?.cancel?.();
  }, []);

  return (
    <div
      ref={lineRef}
      className="fixed left-0 right-0 pointer-events-none"
      style={{
        top: 0,
        height: "2px",
        background:
          "linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.4) 15%, rgba(0,212,255,0.9) 50%, rgba(0,212,255,0.4) 85%, transparent 100%)",
        boxShadow: "0 0 10px rgba(0,212,255,0.7), 0 0 3px rgba(0,212,255,1)",
        zIndex: 9998,
        opacity: 0,
      }}
    />
  );
}
