/**
 * PerfOverlay.jsx — Performance Debug Overlay
 *
 * Shows FPS, total shapes, visible shapes, culled count.
 * Toggle with Ctrl+Shift+P. Updates every 500ms.
 */

import React, { useState, useEffect, useRef } from 'react';

export default function PerfOverlay({ totalShapes, visibleShapes }) {
  const [fps, setFps] = useState(60);
  const frames = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    let rafId;
    const tick = () => {
      frames.current++;
      rafId = requestAnimationFrame(tick);
    };
    tick();

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastTime.current) / 1000;
      setFps(Math.round(frames.current / elapsed));
      frames.current = 0;
      lastTime.current = now;
    }, 500);

    return () => { cancelAnimationFrame(rafId); clearInterval(interval); };
  }, []);

  const culled = totalShapes - visibleShapes;
  const fpsColor = fps >= 50 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="fixed top-14 left-3 z-50 bg-brand-dark/95 backdrop-blur-md border border-brand-grey-lt rounded-xl px-3 py-2 shadow-xl font-mono text-[11px] leading-relaxed">
      <div className="text-brand-grey-txt text-[9px] uppercase tracking-wider mb-1">Performance</div>
      <div className={fpsColor}>FPS: <span className="font-bold">{fps}</span></div>
      <div className="text-brand-white">Total: <span className="font-bold">{totalShapes}</span></div>
      <div className="text-emerald-400">Visible: <span className="font-bold">{visibleShapes}</span></div>
      <div className="text-amber-400">Culled: <span className="font-bold">{culled}</span></div>
    </div>
  );
}
