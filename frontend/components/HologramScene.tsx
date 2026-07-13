"use client";
import { createContext, useContext, useEffect } from "react";
import { useMotionValue, useSpring, MotionValue } from "framer-motion";

interface ParallaxCtx {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

const Ctx = createContext<ParallaxCtx | null>(null);
export const useParallax = () => useContext(Ctx);

export default function HologramScene({ children }: { children: React.ReactNode }) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 55, damping: 20 });
  const y = useSpring(rawY, { stiffness: 55, damping: 20 });

  useEffect(() => {
    if (typeof window === "undefined" || "ontouchstart" in window) return;
    const fn = (e: MouseEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, [rawX, rawY]);

  return <Ctx.Provider value={{ x, y }}>{children}</Ctx.Provider>;
}
