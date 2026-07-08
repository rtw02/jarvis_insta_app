import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          jarvis: "#00D4FF",
          dim: "#0099BB",
          glow: "rgba(0, 212, 255, 0.15)",
        },
        orange: {
          jarvis: "#FF6B35",
          dim: "#CC4400",
        },
        jarvis: {
          bg: "#050508",
          card: "#0a0a14",
          border: "rgba(0, 212, 255, 0.2)",
          text: "#B0C4DE",
        },
      },
      fontFamily: {
        mono: ["Space Mono", "JetBrains Mono", "Courier New", "monospace"],
      },
      animation: {
        scanline: "scanline 2s linear infinite",
        flicker: "flicker 4s linear infinite",
        "ping-slow": "ping 2s cubic-bezier(0,0,0.2,1) infinite",
        "border-flow": "borderFlow 3s linear infinite",
        "text-reveal": "textReveal 0.5s ease forwards",
        "fade-up": "fadeUp 0.4s ease forwards",
        glitch: "glitch 0.3s steps(2) infinite",
        "hud-spin": "hudSpin 8s linear infinite",
      },
      keyframes: {
        scanline: {
          "0%": { top: "0%" },
          "100%": { top: "100%" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "93%": { opacity: "0.8" },
          "94%": { opacity: "1" },
          "96%": { opacity: "0.9" },
          "97%": { opacity: "1" },
        },
        borderFlow: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        textReveal: {
          from: { clipPath: "inset(0 100% 0 0)" },
          to: { clipPath: "inset(0 0% 0 0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glitch: {
          "0%": { clipPath: "inset(20% 0 60% 0)", transform: "translate(-2px)" },
          "50%": { clipPath: "inset(60% 0 10% 0)", transform: "translate(2px)" },
          "100%": { clipPath: "inset(40% 0 40% 0)", transform: "translate(0)" },
        },
        hudSpin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
