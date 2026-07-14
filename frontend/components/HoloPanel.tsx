"use client";
import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useSpring, animated } from "@react-spring/web";
import gsap from "gsap";

interface Props {
  children: React.ReactNode;
  z?: number;          // translateZ depth in px — higher = closer to viewer
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  bobPhase?: number;
}

const CORNERS = [
  { top: 0, left: 0, rotate: 0 },
  { top: 0, right: 0, rotate: 90 },
  { bottom: 0, right: 0, rotate: 180 },
  { bottom: 0, left: 0, rotate: 270 },
] as const;

export default function HoloPanel({
  children,
  z = 0,
  className = "",
  style = {},
  delay = 0,
  bobPhase = 0,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  // React Spring: subtle per-panel float (lighter since scene already breathes)
  const [{ bobY }] = useSpring(() => ({
    from: { bobY: 0 },
    to: { bobY: -(2 + bobPhase) },
    config: { duration: 3200 + bobPhase * 700 },
    loop: { reverse: true },
    delay: bobPhase * 600,
  }));

  // GSAP: corner bracket draw on mount
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const paths = el.querySelectorAll<SVGPathElement>(".holo-bracket-path");
    if (!paths.length) return;
    gsap.set(paths, { strokeDashoffset: 30, opacity: 0 });
    gsap.to(paths, {
      strokeDashoffset: 0,
      opacity: 0.55,
      duration: 0.45,
      delay: delay + 0.2,
      stagger: 0.06,
      ease: "power2.out",
    });
  }, [delay]);

  // Depth fog: panels further back (lower z) are slightly dimmer and desaturated
  const depthOpacity = 0.72 + (z / 100) * 0.28;
  const depthScale   = 0.97 + (z / 100) * 0.03;

  return (
    <animated.div style={{ y: bobY, transformStyle: "preserve-3d" }}>
      <motion.div
        ref={cardRef}
        className={`holo-panel rounded-lg ${className}`}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: depthOpacity, scale: depthScale }}
        transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{
          opacity: 1,
          scale: depthScale + 0.025,
          transition: { duration: 0.2, ease: "easeOut" },
        }}
        style={{ translateZ: z, transformStyle: "preserve-3d", ...style }}
      >
        {CORNERS.map(({ rotate, ...pos }, i) => (
          <svg
            key={i}
            viewBox="0 0 14 14"
            className="absolute w-3.5 h-3.5 pointer-events-none"
            style={{ ...pos, position: "absolute", transform: `rotate(${rotate}deg)`, zIndex: 10 }}
          >
            <path
              className="holo-bracket-path"
              d="M0 10 L0 0 L10 0"
              fill="none"
              stroke="#00D4FF"
              strokeWidth="1.5"
              strokeDasharray="30"
              strokeLinecap="square"
            />
          </svg>
        ))}
        {children}
      </motion.div>
    </animated.div>
  );
}
