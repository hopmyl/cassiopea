"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  base: number;
  amp: number;
  speed: number;
  phase: number;
  hue: "white" | "gold" | "blue";
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export default function StarField({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let stars: Star[] = [];
    let meteors: Meteor[] = [];
    let nextMeteor = performance.now() + 5000;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor(((w * h) / 9000) * density);
      const hues: Star["hue"][] = ["white", "white", "white", "gold", "blue"];
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        base: Math.random() * 0.35 + 0.15,
        amp: Math.random() * 0.5 + 0.15,
        speed: Math.random() * 1.4 + 0.3,
        phase: Math.random() * Math.PI * 2,
        hue: hues[Math.floor(Math.random() * hues.length)],
      }));
    };

    const color = (hue: Star["hue"], alpha: number) =>
      hue === "gold"
        ? `rgba(233, 215, 167, ${alpha})`
        : hue === "blue"
          ? `rgba(150, 180, 255, ${alpha})`
          : `rgba(240, 244, 255, ${alpha})`;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const sec = t / 1000;
      for (const s of stars) {
        const a = reduced ? s.base + s.amp * 0.5 : s.base + s.amp * (0.5 + 0.5 * Math.sin(sec * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = color(s.hue, Math.max(0.05, Math.min(1, a)));
        ctx.fill();
        // яркие звёзды получают крест-лучи
        if (s.r > 1.15 && a > 0.55) {
          ctx.strokeStyle = color(s.hue, a * 0.35);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 3, s.y);
          ctx.lineTo(s.x + s.r * 3, s.y);
          ctx.moveTo(s.x, s.y - s.r * 3);
          ctx.lineTo(s.x, s.y + s.r * 3);
          ctx.stroke();
        }
      }
      // метеоры
      if (!reduced) {
        if (t > nextMeteor) {
          const sx = Math.random() * w * 0.7 + w * 0.15;
          meteors.push({
            x: sx,
            y: Math.random() * h * 0.3,
            vx: -(Math.random() * 3 + 3.5),
            vy: Math.random() * 1.4 + 1.1,
            life: 0,
            maxLife: Math.random() * 40 + 55,
          });
          nextMeteor = t + Math.random() * 9000 + 7000;
        }
        meteors = meteors.filter((m) => m.life < m.maxLife);
        for (const m of meteors) {
          m.x += m.vx;
          m.y += m.vy;
          m.life++;
          const k = 1 - m.life / m.maxLife;
          const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14);
          grad.addColorStop(0, `rgba(247, 236, 201, ${0.8 * k})`);
          grad.addColorStop(1, "rgba(247, 236, 201, 0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * 14, m.y - m.vy * 14);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
