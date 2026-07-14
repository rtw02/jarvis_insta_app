"use client";

import { useEffect, useRef } from "react";

interface Light { x: number; brightness: number; phase: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; size: number }

const TERM_LINES = [
  "JARVIS v4.2.1 BOOT OK", "SYS.CHECK.........OK", "NEURAL.LINK.......ON",
  "THERMAL........38.2°C", "REACTOR........100%",  "NET.UPLINK........ON",
  "GPU.......12.8 TFLOPS", "ENCRYPT......AES-256", "AUTH........T.STARK",
  "SUIT.SYNC..........OK", "BIOMETRIC......MATCH", "ARC.MK7.......STABLE",
  "WEAPONS.......SAFETY", "FLIGHT........READY",  "AI.CORE......ACTIVE",
  "MEMORY......94% ALLOC", "LATENCY..........4ms", "SIGNAL...........98%",
];

export default function GarageBackground() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const mouseRef    = useRef({ x: 0, y: 0 });
  const parallaxRef = useRef({ x: 0, y: 0 });
  const sparksRef   = useRef<Spark[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0, animId: number, t = 0;

    const lights: Light[] = [
      { x: 0.18, brightness: 1, phase: 0.00 },
      { x: 0.38, brightness: 1, phase: 1.37 },
      { x: 0.62, brightness: 1, phase: 2.71 },
      { x: 0.82, brightness: 1, phase: 4.18 },
    ];

    function resize() {
      W = canvas!.width  = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth  - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
    };

    // ── helpers ──────────────────────────────────────────────
    function lerp(a: number, b: number, f: number) { return a + (b - a) * f; }

    // ── Malibu exterior behind garage door ───────────────────
    function drawMalibuExterior(
      doorL: number, doorR: number, doorT: number, doorB: number,
    ) {
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(doorL, doorT, doorR - doorL, doorB - doorT);
      ctx!.clip();

      // Night sky gradient
      const skyH = (doorB - doorT) * 0.65;
      const sky = ctx!.createLinearGradient(0, doorT, 0, doorT + skyH);
      sky.addColorStop(0, "#06090f");
      sky.addColorStop(0.4, "#080c14");
      sky.addColorStop(1, "#0b1018");
      ctx!.fillStyle = sky;
      ctx!.fillRect(doorL, doorT, doorR - doorL, skyH);

      // Ocean / horizon band
      const oceanY = doorT + skyH;
      const ocean = ctx!.createLinearGradient(0, oceanY, 0, doorB);
      ocean.addColorStop(0, "#0a1020");
      ocean.addColorStop(0.3, "#081018");
      ocean.addColorStop(1, "#050c14");
      ctx!.fillStyle = ocean;
      ctx!.fillRect(doorL, oceanY, doorR - doorL, doorB - oceanY);

      // Moon (upper-right quadrant)
      const mx = doorL + (doorR - doorL) * 0.78;
      const my = doorT + (doorB - doorT) * 0.22;
      const moonR = Math.min(doorR - doorL, doorB - doorT) * 0.055;
      const moonG = ctx!.createRadialGradient(mx, my, 0, mx, my, moonR * 2.5);
      moonG.addColorStop(0, "rgba(220,230,255,0.95)");
      moonG.addColorStop(0.4, "rgba(180,200,255,0.5)");
      moonG.addColorStop(1, "rgba(100,140,255,0)");
      ctx!.fillStyle = moonG;
      ctx!.beginPath();
      ctx!.arc(mx, my, moonR * 2.5, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = "rgba(225,235,255,0.92)";
      ctx!.beginPath();
      ctx!.arc(mx, my, moonR, 0, Math.PI * 2);
      ctx!.fill();

      // Stars
      ctx!.fillStyle = "rgba(200,215,255,0.7)";
      const stars = [
        [0.12, 0.08], [0.25, 0.14], [0.38, 0.06], [0.18, 0.28],
        [0.55, 0.10], [0.62, 0.22], [0.30, 0.32], [0.48, 0.28],
        [0.70, 0.16], [0.15, 0.42], [0.44, 0.38], [0.82, 0.08],
        [0.90, 0.30], [0.07, 0.18], [0.60, 0.42],
      ];
      const dw = doorR - doorL, dh = doorB - doorT;
      stars.forEach(([fx, fy]) => {
        const sx = doorL + fx * dw;
        const sy = doorT + fy * dh * 0.6;
        const r = 0.5 + Math.random() * 0.5;
        const twinkle = 0.5 + 0.5 * Math.sin(t * 2 + fx * 10);
        ctx!.globalAlpha = twinkle * 0.8;
        ctx!.beginPath();
        ctx!.arc(sx, sy, r, 0, Math.PI * 2);
        ctx!.fill();
      });
      ctx!.globalAlpha = 1;

      // Moonlight reflection on water (ripple lines)
      ctx!.strokeStyle = "rgba(150,180,255,0.08)";
      ctx!.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const ry = oceanY + (doorB - oceanY) * (0.2 + i * 0.15);
        const rw = (dw * 0.25) * (1 - i * 0.08) * (0.8 + 0.2 * Math.sin(t * 0.7 + i));
        ctx!.beginPath();
        ctx!.moveTo(mx - rw, ry);
        ctx!.lineTo(mx + rw, ry);
        ctx!.stroke();
      }

      // Horizon glow (city lights far right, faint)
      const hg = ctx!.createLinearGradient(doorR - dw * 0.3, oceanY, doorR, oceanY);
      hg.addColorStop(0, "rgba(255,180,60,0)");
      hg.addColorStop(1, "rgba(255,180,60,0.06)");
      ctx!.fillStyle = hg;
      ctx!.fillRect(doorR - dw * 0.3, oceanY - 8, dw * 0.3, 20);

      // Moonlight spilling into garage (light cone from door opening)
      const moonSpill = ctx!.createLinearGradient(
        (doorL + doorR) / 2, doorB,
        (doorL + doorR) / 2, doorB + H * 0.3,
      );
      moonSpill.addColorStop(0, "rgba(140,170,255,0.06)");
      moonSpill.addColorStop(1, "rgba(140,170,255,0)");
      ctx!.fillStyle = moonSpill;
      ctx!.restore();
      ctx!.save();
      ctx!.beginPath();
      ctx!.moveTo(doorL, doorB);
      ctx!.lineTo(doorR, doorB);
      ctx!.lineTo(doorR + (doorR - doorL) * 0.3, doorB + H * 0.3);
      ctx!.lineTo(doorL - (doorR - doorL) * 0.3, doorB + H * 0.3);
      ctx!.closePath();
      ctx!.fillStyle = moonSpill;
      ctx!.fill();
      ctx!.restore();
    }

    // ── Room box ─────────────────────────────────────────────
    function drawRoom() {
      // Ceiling
      ctx!.beginPath();
      ctx!.moveTo(0, 0); ctx!.lineTo(W * 0.20, H * 0.08);
      ctx!.lineTo(W * 0.80, H * 0.08); ctx!.lineTo(W, 0);
      ctx!.closePath();
      const ceilGrad = ctx!.createLinearGradient(0, 0, 0, H * 0.08);
      ceilGrad.addColorStop(0, "#100d08"); ceilGrad.addColorStop(1, "#0c0a06");
      ctx!.fillStyle = ceilGrad; ctx!.fill();

      // Garage door opening — centered on back wall
      const doorL = W * 0.32, doorR = W * 0.68;
      const doorT = H * 0.09, doorB = H * 0.54;
      drawMalibuExterior(doorL, doorR, doorT, doorB);

      // Back wall (left strip)
      ctx!.beginPath();
      ctx!.moveTo(W * 0.20, H * 0.08); ctx!.lineTo(doorL, H * 0.08);
      ctx!.lineTo(doorL, H * 0.56);    ctx!.lineTo(W * 0.20, H * 0.56);
      ctx!.closePath();
      const wallGrad = ctx!.createLinearGradient(0, H * 0.08, 0, H * 0.56);
      wallGrad.addColorStop(0, "#1c160c"); wallGrad.addColorStop(0.5, "#181209");
      wallGrad.addColorStop(1, "#0f0c07");
      ctx!.fillStyle = wallGrad; ctx!.fill();

      // Back wall (right strip)
      ctx!.beginPath();
      ctx!.moveTo(doorR, H * 0.08);    ctx!.lineTo(W * 0.80, H * 0.08);
      ctx!.lineTo(W * 0.80, H * 0.56); ctx!.lineTo(doorR, H * 0.56);
      ctx!.closePath();
      ctx!.fillStyle = wallGrad; ctx!.fill();

      // Back wall (above door)
      ctx!.beginPath();
      ctx!.moveTo(doorL, H * 0.08); ctx!.lineTo(doorR, H * 0.08);
      ctx!.lineTo(doorR, doorT);    ctx!.lineTo(doorL, doorT);
      ctx!.closePath();
      ctx!.fillStyle = wallGrad; ctx!.fill();

      // Door frame — subtle trim
      ctx!.strokeStyle = "#2a2010";
      ctx!.lineWidth = 3;
      ctx!.beginPath();
      ctx!.rect(doorL, doorT, doorR - doorL, doorB - doorT);
      ctx!.stroke();
      // Inner frame line (reveal)
      ctx!.strokeStyle = "#1a1408";
      ctx!.lineWidth = 6;
      ctx!.beginPath();
      ctx!.rect(doorL - 3, doorT - 3, doorR - doorL + 6, doorB - doorT + 3);
      ctx!.stroke();

      // Left wall
      ctx!.beginPath();
      ctx!.moveTo(0, 0); ctx!.lineTo(W * 0.20, H * 0.08);
      ctx!.lineTo(W * 0.20, H * 0.56); ctx!.lineTo(0, H);
      ctx!.closePath();
      const lwGrad = ctx!.createLinearGradient(0, 0, W * 0.20, 0);
      lwGrad.addColorStop(0, "#0a0806"); lwGrad.addColorStop(1, "#141009");
      ctx!.fillStyle = lwGrad; ctx!.fill();

      // Right wall
      ctx!.beginPath();
      ctx!.moveTo(W, 0); ctx!.lineTo(W * 0.80, H * 0.08);
      ctx!.lineTo(W * 0.80, H * 0.56); ctx!.lineTo(W, H);
      ctx!.closePath();
      const rwGrad = ctx!.createLinearGradient(W, 0, W * 0.80, 0);
      rwGrad.addColorStop(0, "#0a0806"); rwGrad.addColorStop(1, "#141009");
      ctx!.fillStyle = rwGrad; ctx!.fill();

      // Floor
      ctx!.beginPath();
      ctx!.moveTo(0, H); ctx!.lineTo(W * 0.20, H * 0.56);
      ctx!.lineTo(W * 0.80, H * 0.56); ctx!.lineTo(W, H);
      ctx!.closePath();
      const floorGrad = ctx!.createLinearGradient(0, H * 0.56, 0, H);
      floorGrad.addColorStop(0, "#0e0b07"); floorGrad.addColorStop(0.4, "#0a0806");
      floorGrad.addColorStop(1, "#060504");
      ctx!.fillStyle = floorGrad; ctx!.fill();
    }

    function drawFloorGrid() {
      ctx!.save();
      ctx!.globalAlpha = 0.18;
      ctx!.strokeStyle = "#3a2c18";
      ctx!.lineWidth = 0.7;
      for (let i = 0; i <= 10; i++) {
        const bx = i / 10;
        ctx!.beginPath();
        ctx!.moveTo(lerp(W * 0.20, W * 0.80, bx), H * 0.56);
        ctx!.lineTo(lerp(0, W, bx), H);
        ctx!.stroke();
      }
      for (let d = 0; d <= 8; d++) {
        const f = d / 8;
        ctx!.beginPath();
        ctx!.moveTo(lerp(W * 0.20, 0, f), lerp(H * 0.56, H, f));
        ctx!.lineTo(lerp(W * 0.80, W, f), lerp(H * 0.56, H, f));
        ctx!.stroke();
      }
      ctx!.restore();
    }

    function drawWallDetails() {
      const bwL = W * 0.20, bwR = W * 0.80, bwT = H * 0.08, bwB = H * 0.56;

      // I-beams
      ctx!.save();
      ctx!.globalAlpha = 0.22;
      ctx!.fillStyle = "#0d0a06";
      ctx!.fillRect(bwL, bwT + (bwB - bwT) * 0.08, bwR - bwL, (bwB - bwT) * 0.025);
      // Vertical columns (left and right of door)
      [[0.20, 0.30], [0.70, 0.80]].forEach(([from, to]) => {
        [from, to].forEach(x => {
          const cx = bwL + (bwR - bwL) * x;
          ctx!.fillRect(cx - 4, bwT, 8, bwB - bwT);
        });
      });
      ctx!.restore();

      // Shelving (right side)
      ctx!.save();
      ctx!.globalAlpha = 0.3;
      ctx!.fillStyle = "#1a1208";
      const rx = W * 0.72, ry = H * 0.20, rw = W * 0.07, rh = H * 0.30;
      ctx!.fillRect(rx, ry, rw, rh);
      ctx!.strokeStyle = "#0d0a06";
      ctx!.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(f => {
        ctx!.beginPath(); ctx!.moveTo(rx, ry + rh * f); ctx!.lineTo(rx + rw, ry + rh * f); ctx!.stroke();
      });
      ctx!.restore();
    }

    function drawIronManSuit() {
      const sx = W * 0.52, sy = H * 0.18, sh = H * 0.28;
      const pulse = Math.sin(t * 2.5) * 0.3 + 0.7;
      ctx!.save();

      // Pedestal
      ctx!.fillStyle = "#0d0a06";
      ctx!.fillRect(sx - 18, sy + sh, 36, 10);
      ctx!.fillRect(sx - 8, sy + sh - 6, 16, 8);

      // Body parts
      ctx!.fillStyle = "#160806";
      ctx!.beginPath();
      ctx!.moveTo(sx - 18, sy + sh * 0.4);
      ctx!.bezierCurveTo(sx - 20, sy + sh * 0.35, sx - 22, sy + sh * 0.15, sx - 15, sy + sh * 0.05);
      ctx!.lineTo(sx + 15, sy + sh * 0.05);
      ctx!.bezierCurveTo(sx + 22, sy + sh * 0.15, sx + 20, sy + sh * 0.35, sx + 18, sy + sh * 0.4);
      ctx!.lineTo(sx + 16, sy + sh * 0.65);
      ctx!.lineTo(sx - 16, sy + sh * 0.65);
      ctx!.closePath();
      ctx!.fill();
      ctx!.beginPath(); ctx!.ellipse(sx, sy + sh * 0.04, 12, 14, 0, 0, Math.PI * 2); ctx!.fill();
      ctx!.fillRect(sx - 14, sy + sh * 0.65, 11, sh * 0.30);
      ctx!.fillRect(sx + 3,  sy + sh * 0.65, 11, sh * 0.30);
      ctx!.beginPath();
      ctx!.moveTo(sx - 18, sy + sh * 0.12); ctx!.lineTo(sx - 28, sy + sh * 0.18);
      ctx!.lineTo(sx - 30, sy + sh * 0.55); ctx!.lineTo(sx - 20, sy + sh * 0.55);
      ctx!.lineTo(sx - 18, sy + sh * 0.40); ctx!.fill();
      ctx!.beginPath();
      ctx!.moveTo(sx + 18, sy + sh * 0.12); ctx!.lineTo(sx + 28, sy + sh * 0.18);
      ctx!.lineTo(sx + 30, sy + sh * 0.55); ctx!.lineTo(sx + 20, sy + sh * 0.55);
      ctx!.lineTo(sx + 18, sy + sh * 0.40); ctx!.fill();

      // Red/gold rim light (Mark III colours from pendant warm light)
      ctx!.shadowColor = "rgba(200, 55, 20, 0.9)";
      ctx!.shadowBlur = 14;
      ctx!.strokeStyle = "rgba(210, 65, 28, 0.55)";
      ctx!.lineWidth = 1.5;
      ctx!.beginPath(); ctx!.ellipse(sx, sy + sh * 0.04, 12, 14, 0, 0, Math.PI * 2); ctx!.stroke();
      ctx!.strokeStyle = "rgba(190, 130, 20, 0.3)";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(sx - 18, sy + sh * 0.12); ctx!.lineTo(sx - 28, sy + sh * 0.18);
      ctx!.lineTo(sx - 30, sy + sh * 0.55); ctx!.stroke();
      ctx!.beginPath();
      ctx!.moveTo(sx + 18, sy + sh * 0.12); ctx!.lineTo(sx + 28, sy + sh * 0.18);
      ctx!.lineTo(sx + 30, sy + sh * 0.55); ctx!.stroke();
      ctx!.shadowBlur = 0;

      // Arc reactor chest glow
      const arc = ctx!.createRadialGradient(sx, sy + sh * 0.25, 0, sx, sy + sh * 0.25, 12);
      arc.addColorStop(0, `rgba(130, 225, 255, ${pulse * 0.95})`);
      arc.addColorStop(0.4, `rgba(80, 185, 255, ${pulse * 0.5})`);
      arc.addColorStop(1, "rgba(0, 120, 255, 0)");
      ctx!.fillStyle = arc;
      ctx!.beginPath(); ctx!.arc(sx, sy + sh * 0.25, 12, 0, Math.PI * 2); ctx!.fill();
      // Hex ring
      ctx!.strokeStyle = `rgba(110, 215, 255, ${pulse * 0.85})`;
      ctx!.lineWidth = 1.2;
      ctx!.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        if (i === 0) ctx!.moveTo(sx + 10 * Math.cos(a), sy + sh * 0.25 + 10 * Math.sin(a));
        else         ctx!.lineTo(sx + 10 * Math.cos(a), sy + sh * 0.25 + 10 * Math.sin(a));
      }
      ctx!.closePath(); ctx!.stroke();

      ctx!.restore();
    }

    function drawWheel(x: number, y: number, r: number) {
      ctx!.beginPath(); ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fillStyle = "#080604"; ctx!.fill();
      ctx!.strokeStyle = "rgba(255,115,28,0.45)"; ctx!.lineWidth = 1.5;
      ctx!.beginPath(); ctx!.arc(x, y, r, 0, Math.PI * 2); ctx!.stroke();
      ctx!.strokeStyle = "rgba(180,80,20,0.25)"; ctx!.lineWidth = 1;
      ctx!.beginPath(); ctx!.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx!.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx!.beginPath();
        ctx!.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
        ctx!.lineTo(x + Math.cos(a) * r * 0.9,  y + Math.sin(a) * r * 0.9);
        ctx!.strokeStyle = "rgba(140,60,15,0.2)"; ctx!.lineWidth = 0.8; ctx!.stroke();
      }
    }

    function drawCar() {
      const cx = W * 0.08, cy = H * 0.56, cw = W * 0.33, ch = H * 0.16;
      ctx!.save();
      ctx!.shadowColor = "rgba(255,120,30,0.3)"; ctx!.shadowBlur = 18;
      ctx!.beginPath();
      ctx!.moveTo(cx, cy);
      ctx!.bezierCurveTo(cx - 4, cy - ch * 0.2, cx - 2, cy - ch * 0.45, cx + cw * 0.06, cy - ch * 0.5);
      ctx!.lineTo(cx + cw * 0.22, cy - ch * 0.62);
      ctx!.bezierCurveTo(cx + cw * 0.26, cy - ch * 0.65, cx + cw * 0.30, cy - ch * 0.70, cx + cw * 0.36, cy - ch * 0.92);
      ctx!.lineTo(cx + cw * 0.60, cy - ch);
      ctx!.bezierCurveTo(cx + cw * 0.68, cy - ch, cx + cw * 0.74, cy - ch * 0.95, cx + cw * 0.78, cy - ch * 0.88);
      ctx!.bezierCurveTo(cx + cw * 0.84, cy - ch * 0.78, cx + cw * 0.86, cy - ch * 0.68, cx + cw * 0.88, cy - ch * 0.58);
      ctx!.lineTo(cx + cw * 0.96, cy - ch * 0.5);
      ctx!.bezierCurveTo(cx + cw, cy - ch * 0.42, cx + cw, cy - ch * 0.18, cx + cw * 0.98, cy);
      ctx!.closePath();
      const bg = ctx!.createLinearGradient(cx, cy - ch, cx, cy);
      bg.addColorStop(0, "#1a1410"); bg.addColorStop(0.5, "#110e0a"); bg.addColorStop(1, "#080604");
      ctx!.fillStyle = bg; ctx!.fill();
      ctx!.strokeStyle = "rgba(255,130,35,0.35)"; ctx!.lineWidth = 1.2; ctx!.stroke();
      ctx!.shadowBlur = 0;
      // R8 side blade vent
      ctx!.beginPath();
      ctx!.moveTo(cx + cw * 0.30, cy - ch * 0.15); ctx!.lineTo(cx + cw * 0.38, cy - ch * 0.42);
      ctx!.lineTo(cx + cw * 0.46, cy - ch * 0.40); ctx!.lineTo(cx + cw * 0.42, cy - ch * 0.14);
      ctx!.closePath();
      ctx!.fillStyle = "rgba(255,110,25,0.08)"; ctx!.fill();
      ctx!.strokeStyle = "rgba(255,120,30,0.25)"; ctx!.lineWidth = 0.8; ctx!.stroke();
      // Windshield
      ctx!.beginPath();
      ctx!.moveTo(cx + cw * 0.30, cy - ch * 0.72); ctx!.lineTo(cx + cw * 0.36, cy - ch * 0.92);
      ctx!.lineTo(cx + cw * 0.60, cy - ch * 0.99); ctx!.lineTo(cx + cw * 0.62, cy - ch * 0.82);
      ctx!.closePath();
      ctx!.fillStyle = "rgba(50,100,160,0.18)"; ctx!.fill();
      ctx!.restore();
      drawWheel(cx + cw * 0.175, cy, ch * 0.38);
      drawWheel(cx + cw * 0.80,  cy, ch * 0.40);
      // Second car (far left, partial)
      ctx!.save(); ctx!.globalAlpha = 0.4;
      const cx2 = -W * 0.04, cw2 = W * 0.22, ch2 = H * 0.11;
      ctx!.beginPath();
      ctx!.moveTo(cx2 + cw2 * 0.45, cy);
      ctx!.bezierCurveTo(cx2 + cw2 * 0.52, cy - ch2 * 0.4, cx2 + cw2 * 0.60, cy - ch2 * 0.85, cx2 + cw2 * 0.70, cy - ch2);
      ctx!.lineTo(cx2 + cw2, cy - ch2 * 0.94);
      ctx!.bezierCurveTo(cx2 + cw2 * 1.04, cy - ch2 * 0.8, cx2 + cw2 * 1.06, cy - ch2 * 0.5, cx2 + cw2 * 1.04, cy);
      ctx!.fillStyle = "#0c0a07"; ctx!.fill(); ctx!.restore();
    }

    function drawDummyArm() {
      // Idle animation: slow oscillating reach
      const reach  = Math.sin(t * 0.55) * 12;
      const sway   = Math.cos(t * 0.40) * 9;
      const wrist  = Math.sin(t * 0.80) * 8;
      const bx = W * 0.35, by = H * 0.50;

      const arm = [
        { x: bx,              y: by },
        { x: bx - 15 + sway,  y: by - H * 0.12 + reach * 0.3 },
        { x: bx - 5  + sway,  y: by - H * 0.24 + reach * 0.6 },
        { x: bx + 20 + sway,  y: by - H * 0.30 + reach },
        { x: bx + 30 + wrist, y: by - H * 0.35 + reach + wrist * 0.5 },
      ];

      ctx!.save();
      ctx!.fillStyle = "#2a2010";
      ctx!.fillRect(bx - 12, by, 24, 12);

      ctx!.strokeStyle = "#3a2e1a"; ctx!.lineWidth = 6;
      ctx!.lineCap = "round"; ctx!.lineJoin = "round";
      ctx!.beginPath(); ctx!.moveTo(arm[0].x, arm[0].y);
      arm.slice(1).forEach(p => ctx!.lineTo(p.x, p.y));
      ctx!.stroke();

      // Joints
      arm.forEach((p, i) => {
        ctx!.beginPath(); ctx!.arc(p.x, p.y, i === 0 ? 8 : 5, 0, Math.PI * 2);
        ctx!.fillStyle = "#4a3820"; ctx!.fill();
        ctx!.strokeStyle = "#6a5030"; ctx!.lineWidth = 1; ctx!.stroke();
      });

      // End effector claw
      const tip = arm[arm.length - 1];
      const clawAngle = Math.sin(t * 0.55) * 0.3;
      ctx!.strokeStyle = "#4a3820"; ctx!.lineWidth = 3;
      [[12, 8], [14, -6]].forEach(([dx, dy]) => {
        const ex = tip.x + Math.cos(clawAngle) * dx - Math.sin(clawAngle) * dy;
        const ey = tip.y + Math.sin(clawAngle) * dx + Math.cos(clawAngle) * dy;
        ctx!.beginPath(); ctx!.moveTo(tip.x, tip.y); ctx!.lineTo(ex, ey); ctx!.stroke();
      });
      ctx!.restore();
    }

    // ── Monitor display content ───────────────────────────────
    function drawMonitorTerminal(mx: number, my: number, mw: number, mh: number) {
      ctx!.save();
      ctx!.beginPath(); ctx!.rect(mx + 1, my + 1, mw - 2, mh - 2); ctx!.clip();

      const fs = Math.max(5, mw * 0.055);
      ctx!.font = `${fs}px "Courier New", monospace`;

      const lineH = fs * 1.55;
      const visLines = Math.floor((mh - 6) / lineH) + 1;
      const scrollOffset = (t * 0.18) % 1; // fraction scroll per cycle
      const startLine   = Math.floor(t * 0.18) % TERM_LINES.length;

      for (let row = 0; row < visLines + 1; row++) {
        const lineIdx = (startLine + row) % TERM_LINES.length;
        const text = TERM_LINES[lineIdx];
        const y = my + 6 + row * lineH - scrollOffset * lineH;
        // Cursor blink on last visible line
        const isCursor = row === visLines - 1;
        const alpha = isCursor ? (Math.sin(t * 4) * 0.5 + 0.5) * 0.9 + 0.1 : 0.65;
        ctx!.fillStyle = isCursor ? `rgba(0,220,180,${alpha})` : "rgba(0,190,150,0.55)";
        ctx!.fillText(text, mx + 4, y);
      }
      // Scanline overlay
      ctx!.fillStyle = "rgba(0,0,0,0.12)";
      for (let sy = my + 1; sy < my + mh; sy += 2) ctx!.fillRect(mx + 1, sy, mw - 2, 1);
      ctx!.restore();
    }

    function drawMonitorSchematic(mx: number, my: number, mw: number, mh: number) {
      ctx!.save();
      ctx!.beginPath(); ctx!.rect(mx + 1, my + 1, mw - 2, mh - 2); ctx!.clip();

      const cx = mx + mw / 2, cy = my + mh * 0.52;
      const maxR = Math.min(mw, mh) * 0.32;

      // Outer rotating ring of tick marks
      ctx!.strokeStyle = "rgba(0,180,255,0.18)"; ctx!.lineWidth = 0.5;
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2 + t * 0.3;
        const r0 = maxR * 0.95, r1 = maxR * (i % 3 === 0 ? 0.82 : 0.88);
        ctx!.beginPath();
        ctx!.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx!.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx!.stroke();
      }

      // Three concentric rings (reactor structure)
      [1.0, 0.68, 0.40].forEach((rf, ri) => {
        const r = maxR * rf;
        ctx!.strokeStyle = ri === 1
          ? `rgba(0,212,255,${0.5 + Math.sin(t * 2.5) * 0.15})`
          : "rgba(0,160,220,0.25)";
        ctx!.lineWidth = ri === 1 ? 1.2 : 0.6;
        ctx!.beginPath(); ctx!.arc(cx, cy, r, 0, Math.PI * 2); ctx!.stroke();
      });

      // 6 radial spokes (counter-rotating)
      ctx!.strokeStyle = "rgba(0,180,255,0.22)"; ctx!.lineWidth = 0.6;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - t * 0.5;
        ctx!.beginPath();
        ctx!.moveTo(cx + Math.cos(a) * maxR * 0.40, cy + Math.sin(a) * maxR * 0.40);
        ctx!.lineTo(cx + Math.cos(a) * maxR * 0.68, cy + Math.sin(a) * maxR * 0.68);
        ctx!.stroke();
      }

      // Core hex (rotating)
      const pulse = Math.sin(t * 2.5) * 0.3 + 0.7;
      const coreG = ctx!.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.22);
      coreG.addColorStop(0, `rgba(180,240,255,${pulse * 0.9})`);
      coreG.addColorStop(0.5, `rgba(60,180,255,${pulse * 0.4})`);
      coreG.addColorStop(1, "rgba(0,100,200,0)");
      ctx!.fillStyle = coreG;
      ctx!.beginPath(); ctx!.arc(cx, cy, maxR * 0.22, 0, Math.PI * 2); ctx!.fill();

      ctx!.strokeStyle = `rgba(100,210,255,${pulse * 0.85})`; ctx!.lineWidth = 0.8;
      ctx!.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 1.2;
        if (i === 0) ctx!.moveTo(cx + maxR * 0.14 * Math.cos(a), cy + maxR * 0.14 * Math.sin(a));
        else         ctx!.lineTo(cx + maxR * 0.14 * Math.cos(a), cy + maxR * 0.14 * Math.sin(a));
      }
      ctx!.closePath(); ctx!.stroke();

      // Label
      ctx!.fillStyle = "rgba(0,180,255,0.35)";
      ctx!.font = `${Math.max(4, mw * 0.045)}px "Courier New", monospace`;
      ctx!.textAlign = "center";
      ctx!.fillText("ARC REACTOR MK.VII", cx, my + 8);
      ctx!.fillText(`${(pulse * 100).toFixed(0)}%`, cx, my + mh - 5);
      ctx!.textAlign = "left";

      ctx!.fillStyle = "rgba(0,0,0,0.12)";
      for (let sy = my + 1; sy < my + mh; sy += 2) ctx!.fillRect(mx + 1, sy, mw - 2, 1);
      ctx!.restore();
    }

    function drawMonitorWaveform(mx: number, my: number, mw: number, mh: number) {
      ctx!.save();
      ctx!.beginPath(); ctx!.rect(mx + 1, my + 1, mw - 2, mh - 2); ctx!.clip();

      const midY = my + mh * 0.38;
      const mid2Y = my + mh * 0.72;
      const amp1 = mh * 0.14, amp2 = mh * 0.10;
      const steps = Math.floor(mw);

      // Channel 1 — cyan power waveform
      ctx!.strokeStyle = "rgba(0,212,255,0.7)"; ctx!.lineWidth = 1;
      ctx!.beginPath();
      for (let px = 0; px <= steps; px++) {
        const nx = px / steps;
        const wave = Math.sin((nx * 8 + t * 3) * Math.PI * 2) * amp1
                   + Math.sin((nx * 3 + t * 1.7) * Math.PI * 2) * amp1 * 0.35
                   + Math.sin((nx * 15 + t * 5) * Math.PI * 2) * amp1 * 0.12;
        const px_ = mx + 1 + px;
        const py  = midY + wave;
        if (px === 0) ctx!.moveTo(px_, py); else ctx!.lineTo(px_, py);
      }
      ctx!.stroke();

      // Channel 2 — orange neural readout
      ctx!.strokeStyle = "rgba(255,140,30,0.55)"; ctx!.lineWidth = 0.8;
      ctx!.beginPath();
      for (let px = 0; px <= steps; px++) {
        const nx = px / steps;
        const wave = Math.sin((nx * 5 + t * 2.1) * Math.PI * 2) * amp2
                   + Math.sin((nx * 11 + t * 4.3) * Math.PI * 2) * amp2 * 0.4;
        const px_ = mx + 1 + px;
        const py  = mid2Y + wave;
        if (px === 0) ctx!.moveTo(px_, py); else ctx!.lineTo(px_, py);
      }
      ctx!.stroke();

      // Divider line between channels
      ctx!.strokeStyle = "rgba(255,255,255,0.06)"; ctx!.lineWidth = 0.5;
      ctx!.beginPath(); ctx!.moveTo(mx + 1, my + mh * 0.55); ctx!.lineTo(mx + mw - 1, my + mh * 0.55); ctx!.stroke();

      // Labels
      const lfs = Math.max(4, mw * 0.042);
      ctx!.font = `${lfs}px "Courier New", monospace`;
      ctx!.fillStyle = "rgba(0,212,255,0.4)"; ctx!.fillText("CH1 PWR", mx + 3, my + 7);
      ctx!.fillStyle = "rgba(255,140,30,0.4)"; ctx!.fillText("CH2 NEU", mx + 3, my + mh * 0.55 + 8);

      ctx!.fillStyle = "rgba(0,0,0,0.12)";
      for (let sy = my + 1; sy < my + mh; sy += 2) ctx!.fillRect(mx + 1, sy, mw - 2, 1);
      ctx!.restore();
    }

    // ── Sparks ────────────────────────────────────────────────
    function emitSparks() {
      if (Math.random() > 0.18) return; // ~11/s at 60fps
      const ax = W * 0.876, ay = H * 0.532;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.85;
      const speed = 0.8 + Math.random() * 2.2;
      sparksRef.current.push({
        x: ax + (Math.random() - 0.5) * 18,
        y: ay,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 1,
        size: 0.8 + Math.random() * 1.4,
      });
    }

    function drawSparks() {
      sparksRef.current = sparksRef.current.filter(s => s.life > 0);
      sparksRef.current.forEach(s => {
        s.x  += s.vx;
        s.y  += s.vy;
        s.vy += 0.06; // gravity
        s.life -= 0.022 + Math.random() * 0.01;

        const a = s.life * 0.9;
        // Trail
        ctx!.strokeStyle = `rgba(180,220,255,${a * 0.5})`;
        ctx!.lineWidth = s.size * 0.5;
        ctx!.beginPath();
        ctx!.moveTo(s.x - s.vx * 3, s.y - s.vy * 3);
        ctx!.lineTo(s.x, s.y);
        ctx!.stroke();
        // Core dot
        ctx!.fillStyle = `rgba(220,240,255,${a})`;
        ctx!.beginPath(); ctx!.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx!.fill();
      });
    }

    function drawWorkbench() {
      const wx = W * 0.72, wy = H * 0.55, ww = W * 0.30, wh = H * 0.06;
      ctx!.save();
      ctx!.fillStyle = "#1a1208"; ctx!.fillRect(wx, wy, ww, wh);
      ctx!.fillStyle = "#251a0c"; ctx!.fillRect(wx, wy, ww, 2);

      const mw = ww * 0.28;
      [0.05, 0.36, 0.67].forEach((off, i) => {
        const mx = wx + ww * off, my = wy - H * 0.16, mh = H * 0.14;
        // Monitor bezel
        ctx!.fillStyle = "#0a090c"; ctx!.fillRect(mx, my, mw, mh);
        ctx!.strokeStyle = "rgba(0,180,255,0.2)"; ctx!.lineWidth = 0.5;
        ctx!.strokeRect(mx, my, mw, mh);
        // Animated content per monitor
        if (i === 0) drawMonitorTerminal(mx, my, mw, mh);
        if (i === 1) drawMonitorSchematic(mx, my, mw, mh);
        if (i === 2) drawMonitorWaveform(mx, my, mw, mh);
        // Screen glow on face
        const sg = ctx!.createLinearGradient(mx, my, mx + mw, my + mh * 0.5);
        sg.addColorStop(0, "rgba(0,180,255,0.04)"); sg.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.fillStyle = sg; ctx!.fillRect(mx, my, mw, mh);
        // Stand
        ctx!.fillStyle = "#0c0a08"; ctx!.fillRect(mx + mw * 0.4, my + mh, mw * 0.2, H * 0.02);
      });

      // Arc reactor prototype
      const pulse = Math.sin(t * 2.5) * 0.3 + 0.7;
      const ax = wx + ww * 0.52, ay = wy - H * 0.018;
      const ag = ctx!.createRadialGradient(ax, ay, 0, ax, ay, 55);
      ag.addColorStop(0,   `rgba(160,230,255,${pulse * 0.9})`);
      ag.addColorStop(0.3, `rgba(80,200,255,${pulse * 0.55})`);
      ag.addColorStop(0.6, `rgba(30,140,255,${pulse * 0.25})`);
      ag.addColorStop(1,   "rgba(0,60,200,0)");
      ctx!.fillStyle = ag;
      ctx!.beginPath(); ctx!.arc(ax, ay, 55, 0, Math.PI * 2); ctx!.fill();
      ctx!.fillStyle = `rgba(185,242,255,${pulse})`;
      ctx!.beginPath(); ctx!.arc(ax, ay, 6, 0, Math.PI * 2); ctx!.fill();
      ctx!.strokeStyle = `rgba(105,212,255,${pulse * 0.8})`; ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        if (i === 0) ctx!.moveTo(ax + 10 * Math.cos(a), ay + 10 * Math.sin(a));
        else         ctx!.lineTo(ax + 10 * Math.cos(a), ay + 10 * Math.sin(a));
      }
      ctx!.closePath(); ctx!.stroke();
      ctx!.restore();
    }

    function drawPendantLights() {
      lights.forEach(light => {
        light.brightness = 0.85 + (Math.sin(t * 7.3 + light.phase) * 0.5 + 0.5) * 0.15;
        if (Math.random() < 0.002) light.brightness *= 0.3;

        const lx = W * light.x, ly = H * 0.07, a = light.brightness;
        ctx!.save();
        ctx!.strokeStyle = "#2a2018"; ctx!.lineWidth = 1.5;
        ctx!.beginPath(); ctx!.moveTo(lx, 0); ctx!.lineTo(lx, ly); ctx!.stroke();
        ctx!.fillStyle = "#3a2a18";
        ctx!.beginPath(); ctx!.arc(lx, ly, 7, 0, Math.PI * 2); ctx!.fill();
        ctx!.fillStyle = `rgba(255,195,80,${a * 0.95})`;
        ctx!.beginPath(); ctx!.arc(lx, ly, 4, 0, Math.PI * 2); ctx!.fill();
        const cH = H * 0.55, cW = cH * 0.55;
        const cg = ctx!.createRadialGradient(lx, ly, 0, lx, ly, cH);
        cg.addColorStop(0,   `rgba(255,190,80,${a * 0.28})`);
        cg.addColorStop(0.2, `rgba(255,165,55,${a * 0.12})`);
        cg.addColorStop(0.5, `rgba(255,140,40,${a * 0.04})`);
        cg.addColorStop(1,   "rgba(255,120,30,0)");
        ctx!.fillStyle = cg;
        ctx!.beginPath();
        ctx!.moveTo(lx, ly); ctx!.lineTo(lx - cW, ly + cH); ctx!.lineTo(lx + cW, ly + cH);
        ctx!.closePath(); ctx!.fill();
        ctx!.restore();
      });
    }

    function drawAtmosphere() {
      const pulse = Math.sin(t * 2.5) * 0.3 + 0.7;
      // Arc reactor blue ambient (right)
      const haze = ctx!.createRadialGradient(W * 0.82, H * 0.45, 0, W * 0.82, H * 0.45, W * 0.35);
      haze.addColorStop(0, `rgba(30,100,200,${0.05 + pulse * 0.02})`);
      haze.addColorStop(1, "rgba(0,30,80,0)");
      ctx!.fillStyle = haze; ctx!.fillRect(0, 0, W, H);
      // Moonlight wash through door
      const doorCX = W * 0.5, doorB = H * 0.54;
      const ml = ctx!.createRadialGradient(doorCX, doorB, 0, doorCX, doorB, W * 0.4);
      ml.addColorStop(0, "rgba(130,160,255,0.055)");
      ml.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = ml; ctx!.fillRect(0, 0, W, H);
      // Warm tungsten overflow
      const warm = ctx!.createRadialGradient(W * 0.5, H * 0.1, 0, W * 0.5, H * 0.5, W * 0.6);
      warm.addColorStop(0, "rgba(255,150,50,0.055)");
      warm.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = warm; ctx!.fillRect(0, 0, W, H);
      // Floor haze
      const dust = ctx!.createLinearGradient(0, H * 0.6, 0, H);
      dust.addColorStop(0, "rgba(20,14,8,0)");
      dust.addColorStop(1, "rgba(8,6,4,0.5)");
      ctx!.fillStyle = dust; ctx!.fillRect(0, H * 0.6, W, H);
    }

    // ── Main loop ─────────────────────────────────────────────
    function draw() {
      t += 0.016;

      // Lerp parallax toward mouse target
      const targetX = mouseRef.current.x * W * 0.022;
      const targetY = mouseRef.current.y * H * 0.012;
      parallaxRef.current.x = lerp(parallaxRef.current.x, targetX, 0.04);
      parallaxRef.current.y = lerp(parallaxRef.current.y, targetY, 0.04);

      ctx!.clearRect(0, 0, W, H);
      ctx!.fillStyle = "#060504";
      ctx!.fillRect(0, 0, W, H);

      ctx!.save();
      ctx!.translate(parallaxRef.current.x, parallaxRef.current.y);

      drawRoom();
      drawFloorGrid();
      drawWallDetails();
      drawIronManSuit();
      drawDummyArm();
      drawCar();
      drawWorkbench();
      emitSparks();
      drawSparks();
      drawPendantLights();
      drawAtmosphere();

      ctx!.restore();

      animId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, display: "block" }}
    />
  );
}
