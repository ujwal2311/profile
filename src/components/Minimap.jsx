/**
 * Minimap.jsx — Viewport Overview Widget
 *
 * 160×100px minimap showing all strokes as tiny dots.
 * Blue rectangle = current viewport. Click to teleport.
 * Toggle with M key.
 */

import React, { useRef, useEffect, useCallback } from 'react';

const MAP_W = 160, MAP_H = 100;
const WORLD_W = 4000, WORLD_H = 2500; // Assumed world bounds for mapping

export default function Minimap({ strokes, remoteStrokes, viewport, canvasW, canvasH, onTeleport }) {
  const canvasRef = useRef(null);

  // Redraw minimap strokes every 2s
  useEffect(() => {
    const draw = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, MAP_W, MAP_H);

      // Background
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      // Grid
      ctx.strokeStyle = '#1E1E1E';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < MAP_W; x += MAP_W / 10) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke();
      }
      for (let y = 0; y < MAP_H; y += MAP_H / 10) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke();
      }

      const scaleX = MAP_W / WORLD_W, scaleY = MAP_H / WORLD_H;

      // Draw strokes as tiny colored dots
      const allStrokes = [...(strokes || []), ...(remoteStrokes || [])];
      for (const s of allStrokes) {
        ctx.fillStyle = s.color || '#FACC15';
        const pts = s.points;
        if (!pts) continue;
        // Sample every 8th point for performance
        for (let i = 0; i < pts.length - 1; i += 16) {
          const mx = (pts[i] + WORLD_W / 2) * scaleX;
          const my = (pts[i + 1] + WORLD_H / 2) * scaleY;
          ctx.fillRect(mx, my, 1.5, 1.5);
        }
      }

      // Viewport rectangle
      const vx = ((-viewport.x / viewport.scale) + WORLD_W / 2) * scaleX;
      const vy = ((-viewport.y / viewport.scale) + WORLD_H / 2) * scaleY;
      const vw = (canvasW / viewport.scale) * scaleX;
      const vh = (canvasH / viewport.scale) * scaleY;
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(vx, vy, vw, vh);
    };

    draw();
    const interval = setInterval(draw, 2000);
    return () => clearInterval(interval);
  }, [strokes, remoteStrokes, viewport, canvasW, canvasH]);

  const handleClick = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert minimap coords to world coords
    const worldX = (clickX / MAP_W) * WORLD_W - WORLD_W / 2;
    const worldY = (clickY / MAP_H) * WORLD_H - WORLD_H / 2;

    // Center viewport on clicked world position
    onTeleport?.({
      x: -(worldX * viewport.scale) + canvasW / 2,
      y: -(worldY * viewport.scale) + canvasH / 2,
    });
  }, [viewport, canvasW, canvasH, onTeleport]);

  return (
    <div className="fixed bottom-20 md:bottom-4 right-20 z-30 rounded-xl overflow-hidden border border-brand-grey-lt shadow-2xl shadow-black/50 bg-brand-dark/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-2 py-1 border-b border-brand-grey-lt/50">
        <span className="text-[9px] text-brand-grey-txt font-medium tracking-wider uppercase">Minimap</span>
      </div>
      <canvas
        ref={canvasRef}
        width={MAP_W}
        height={MAP_H}
        onClick={handleClick}
        className="cursor-crosshair block"
        style={{ width: MAP_W, height: MAP_H }}
      />
    </div>
  );
}
