"use client";
import { useRef, useEffect } from "react";
import { motion, useTransform, useMotionValue } from "framer-motion";
import { useSpring, animated } from "@react-spring/web";
import gsap from "gsap";
import { useParallax } from "./HologramScene";

interface Props {
  children: React.ReactNode;
  depth?: number;
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
  depth = 0,
  className = "",
  style = {},
  delay = 0,
  bobPhase = 0,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const parallax = useParallax();

  // React Spring: gentle floating bob — each panel has a different period + delay
  const [{ bobY }] = useSpring(() => ({
    from: { bobY: 0 },
    to: { bobY: -(4 + bobPhase * 1.5) },
    config: { duration: 2800 + bobPhase * 600 },
    loop: { reverse: true },
    delay: bobPhase * 450,
  }));

  // GSAP: draw the SVG corner brackets on mount
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const paths = el.querySelectorAll<SVGPathElement>(".holo-bracket-path");
    if (!paths.length) return;
    gsap.set(paths, { strokeDashoffset: 30, opacity: 0 });
    gsap.to(paths, {
      strokeDashoffset: 0,
      opacity: 0.6,
      duration: 0.45,
      delay: delay + 0.2,
      stagger: 0.06,
      ease: "power2.out",
    });
  }, [delay]);

  // Framer Motion: parallax shift based on mouse position × depth factor
  // Always call hooks — use a static zero MotionValue when no parallax context
  const zeroMV = useMotionValue(0);
  const pX = useTransform(parallax?.x ?? zeroMV, [-1, 1], [-depth * 0.08, depth * 0.08]);
  const pY = useTransform(parallax?.y ?? zeroMV, [-1, 1], [-depth * 0.05, depth * 0.05]);

  return (
    <animated.div style={{ y: bobY }}>
      <motion.div
        ref={cardRef}
        className={`holo-panel rounded-lg ${className}`}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ scale: 1.022, transition: { duration: 0.2, ease: "easeOut" } }}
        style={{ x: pX, y: pY, ...style }}
      >
        {/* Corner bracket SVGs — GSAP draws strokeDashoffset on mount */}
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
