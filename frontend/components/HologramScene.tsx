"use client";
import { useEffect, useRef, useState } from "react";
import { useSpring, animated } from "@react-spring/web";

const SENSITIVITY = 0.28;   // degrees per pixel dragged
const INERTIA_DECAY = 0.92; // multiplier per frame after release
const INERTIA_MIN = 0.04;   // stop inertia below this speed

export default function HologramScene({ children }: { children: React.ReactNode }) {
  // Accumulated rotation (refs = no re-render lag during drag)
  const rotXRef = useRef(0);
  const rotYRef = useRef(0);

  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const inertiaId = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hintVisible, setHintVisible] = useState(true);

  const [{ rotX, rotY }, rotApi] = useSpring(() => ({
    rotX: 0,
    rotY: 0,
    config: { tension: 200, friction: 30 },
  }));

  // Camera breathing — separate spring, runs independently
  const [{ breathY, breathS }] = useSpring(() => ({
    from: { breathY: 0, breathS: 1 },
    to: { breathY: -6, breathS: 1.004 },
    config: { duration: 4000 },
    loop: { reverse: true },
    delay: 1200,
  }));

  useEffect(() => {
    const cancelInertia = () => {
      if (inertiaId.current !== null) {
        cancelAnimationFrame(inertiaId.current);
        inertiaId.current = null;
      }
    };

    const startInertia = () => {
      let vx = velocity.current.x;
      let vy = velocity.current.y;

      const tick = () => {
        vx *= INERTIA_DECAY;
        vy *= INERTIA_DECAY;
        if (Math.abs(vx) < INERTIA_MIN && Math.abs(vy) < INERTIA_MIN) {
          inertiaId.current = null;
          return;
        }
        rotYRef.current += vx;
        // Clamp X to avoid flipping fully upside-down
        rotXRef.current = Math.max(-80, Math.min(80, rotXRef.current + vy));
        rotApi.start({ rotX: rotXRef.current, rotY: rotYRef.current, immediate: true });
        inertiaId.current = requestAnimationFrame(tick);
      };
      inertiaId.current = requestAnimationFrame(tick);
    };

    // ── Mouse ──
    const onMouseDown = (e: MouseEvent) => {
      cancelInertia();
      isDragging.current = true;
      setHintVisible(false);
      lastPos.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: 0, y: 0 };
      if (wrapperRef.current) wrapperRef.current.style.cursor = "grabbing";
      // Prevent text selection while dragging
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = (e.clientX - lastPos.current.x) * SENSITIVITY;
      const dy = (e.clientY - lastPos.current.y) * SENSITIVITY;
      lastPos.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: dx, y: dy };

      rotYRef.current += dx;
      rotXRef.current = Math.max(-80, Math.min(80, rotXRef.current + dy));
      rotApi.start({ rotX: rotXRef.current, rotY: rotYRef.current, immediate: true });
    };

    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (wrapperRef.current) wrapperRef.current.style.cursor = "grab";
      startInertia();
    };

    // ── Touch ──
    const onTouchStart = (e: TouchEvent) => {
      cancelInertia();
      isDragging.current = true;
      const t = e.touches[0];
      lastPos.current = { x: t.clientX, y: t.clientY };
      velocity.current = { x: 0, y: 0 };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const t = e.touches[0];
      const dx = (t.clientX - lastPos.current.x) * SENSITIVITY;
      const dy = (t.clientY - lastPos.current.y) * SENSITIVITY;
      lastPos.current = { x: t.clientX, y: t.clientY };
      velocity.current = { x: dx, y: dy };

      rotYRef.current += dx;
      rotXRef.current = Math.max(-80, Math.min(80, rotXRef.current + dy));
      rotApi.start({ rotX: rotXRef.current, rotY: rotYRef.current, immediate: true });
    };

    const onTouchEnd = () => {
      isDragging.current = false;
      startInertia();
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      cancelInertia();
    };
  }, [rotApi]);

  return (
    <div
      ref={wrapperRef}
      style={{ perspective: "2800px", perspectiveOrigin: "50% 36%", cursor: "grab", position: "relative" }}
    >
      {hintVisible && (
        <div
          style={{
            position: "fixed",
            bottom: 72,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9985,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "rgba(0,212,255,0.35)",
            fontFamily: "Space Mono, monospace",
            fontSize: 9,
            letterSpacing: "0.22em",
            animation: "fadeInOut 3s ease forwards",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="rgba(0,212,255,0.4)" strokeWidth="0.8"/>
            <path d="M4 7h6M7 4v6" stroke="rgba(0,212,255,0.4)" strokeWidth="0.8"/>
          </svg>
          DRAG TO ROTATE
        </div>
      )}
      <animated.div
        style={{
          rotateX: rotX,
          rotateY: rotY,
          y: breathY,
          scale: breathS,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        {children}
      </animated.div>
    </div>
  );
}
