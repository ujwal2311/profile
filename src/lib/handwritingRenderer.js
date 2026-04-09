/**
 * handwritingRenderer.js — Voice-to-Handwriting Engine
 *
 * Converts a text string into animated canvas pen strokes that simulate
 * natural handwriting. Uses normalized bezier-sampled letter paths for
 * every lowercase a-z plus space, scaled to any font size.
 *
 * Each letter is defined as an array of strokes, where each stroke is
 * an array of {x,y} control points in normalized 0–1 coordinate space.
 * Letters occupy a 1.0 wide × 1.4 tall bounding box.
 */

import Konva from 'konva';
import { generateStrokeId } from './idGenerator';

/* ═══════════════════════════════════════════════════════════════════
   BEZIER HELPERS
   ═══════════════════════════════════════════════════════════════════ */

function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function sampleBezier(p0, p1, p2, p3, samples = 16) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    pts.push(cubicBezier(p0, p1, p2, p3, i / samples));
  }
  return pts;
}

function buildStroke(segments) {
  const pts = [];
  for (let i = 0; i < segments.length; i++) {
    const [p0, p1, p2, p3] = segments[i];
    const sampled = sampleBezier(p0, p1, p2, p3, 14);
    for (let j = i === 0 ? 0 : 1; j < sampled.length; j++) {
      pts.push(sampled[j]);
    }
  }
  return pts;
}

function polyStroke(points) {
  return points;
}

/* ═══════════════════════════════════════════════════════════════════
   LETTER PATH DEFINITIONS — normalized 0–1 coordinates
   ═══════════════════════════════════════════════════════════════════ */

const letterPaths = {
  a: [
    buildStroke([
      [{ x: 0.75, y: 0.45 }, { x: 0.7, y: 0.3 }, { x: 0.3, y: 0.3 }, { x: 0.15, y: 0.5 }],
      [{ x: 0.15, y: 0.5 }, { x: 0.0, y: 0.7 }, { x: 0.15, y: 1.0 }, { x: 0.5, y: 1.0 }],
      [{ x: 0.5, y: 1.0 }, { x: 0.75, y: 1.0 }, { x: 0.85, y: 0.85 }, { x: 0.8, y: 0.7 }],
    ]),
    buildStroke([
      [{ x: 0.8, y: 0.35 }, { x: 0.8, y: 0.5 }, { x: 0.8, y: 0.75 }, { x: 0.8, y: 1.0 }],
    ]),
  ],
  b: [
    buildStroke([
      [{ x: 0.2, y: 0.0 }, { x: 0.2, y: 0.3 }, { x: 0.2, y: 0.7 }, { x: 0.2, y: 1.0 }],
    ]),
    buildStroke([
      [{ x: 0.2, y: 0.4 }, { x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.85, y: 0.5 }],
      [{ x: 0.85, y: 0.5 }, { x: 1.0, y: 0.7 }, { x: 0.85, y: 1.0 }, { x: 0.5, y: 1.0 }],
      [{ x: 0.5, y: 1.0 }, { x: 0.3, y: 1.0 }, { x: 0.2, y: 0.95 }, { x: 0.2, y: 0.9 }],
    ]),
  ],
  c: [
    buildStroke([
      [{ x: 0.85, y: 0.45 }, { x: 0.7, y: 0.3 }, { x: 0.3, y: 0.3 }, { x: 0.15, y: 0.5 }],
      [{ x: 0.15, y: 0.5 }, { x: 0.0, y: 0.7 }, { x: 0.0, y: 0.85 }, { x: 0.15, y: 1.0 }],
      [{ x: 0.15, y: 1.0 }, { x: 0.3, y: 1.05 }, { x: 0.65, y: 1.05 }, { x: 0.85, y: 0.9 }],
    ]),
  ],
  d: [
    buildStroke([
      [{ x: 0.8, y: 0.0 }, { x: 0.8, y: 0.3 }, { x: 0.8, y: 0.7 }, { x: 0.8, y: 1.0 }],
    ]),
    buildStroke([
      [{ x: 0.8, y: 0.45 }, { x: 0.7, y: 0.3 }, { x: 0.3, y: 0.3 }, { x: 0.15, y: 0.5 }],
      [{ x: 0.15, y: 0.5 }, { x: 0.0, y: 0.7 }, { x: 0.15, y: 1.0 }, { x: 0.5, y: 1.0 }],
      [{ x: 0.5, y: 1.0 }, { x: 0.7, y: 1.0 }, { x: 0.8, y: 0.95 }, { x: 0.8, y: 0.9 }],
    ]),
  ],
  e: [
    buildStroke([
      [{ x: 0.15, y: 0.65 }, { x: 0.3, y: 0.65 }, { x: 0.7, y: 0.65 }, { x: 0.85, y: 0.65 }],
      [{ x: 0.85, y: 0.65 }, { x: 0.85, y: 0.45 }, { x: 0.65, y: 0.3 }, { x: 0.45, y: 0.3 }],
      [{ x: 0.45, y: 0.3 }, { x: 0.2, y: 0.3 }, { x: 0.05, y: 0.5 }, { x: 0.05, y: 0.7 }],
      [{ x: 0.05, y: 0.7 }, { x: 0.05, y: 0.9 }, { x: 0.2, y: 1.05 }, { x: 0.5, y: 1.05 }],
      [{ x: 0.5, y: 1.05 }, { x: 0.7, y: 1.05 }, { x: 0.8, y: 0.95 }, { x: 0.85, y: 0.9 }],
    ]),
  ],
  f: [
    buildStroke([
      [{ x: 0.7, y: 0.1 }, { x: 0.6, y: 0.0 }, { x: 0.35, y: 0.0 }, { x: 0.35, y: 0.2 }],
      [{ x: 0.35, y: 0.2 }, { x: 0.35, y: 0.5 }, { x: 0.35, y: 0.75 }, { x: 0.35, y: 1.0 }],
    ]),
    polyStroke([{ x: 0.1, y: 0.45 }, { x: 0.3, y: 0.45 }, { x: 0.6, y: 0.45 }]),
  ],
  g: [
    buildStroke([
      [{ x: 0.75, y: 0.45 }, { x: 0.7, y: 0.3 }, { x: 0.3, y: 0.3 }, { x: 0.15, y: 0.5 }],
      [{ x: 0.15, y: 0.5 }, { x: 0.0, y: 0.7 }, { x: 0.15, y: 1.0 }, { x: 0.5, y: 1.0 }],
      [{ x: 0.5, y: 1.0 }, { x: 0.75, y: 1.0 }, { x: 0.8, y: 0.9 }, { x: 0.8, y: 0.8 }],
    ]),
    buildStroke([
      [{ x: 0.8, y: 0.35 }, { x: 0.8, y: 0.6 }, { x: 0.8, y: 0.9 }, { x: 0.8, y: 1.15 }],
      [{ x: 0.8, y: 1.15 }, { x: 0.8, y: 1.35 }, { x: 0.5, y: 1.4 }, { x: 0.2, y: 1.3 }],
    ]),
  ],
  h: [
    buildStroke([
      [{ x: 0.2, y: 0.0 }, { x: 0.2, y: 0.3 }, { x: 0.2, y: 0.7 }, { x: 0.2, y: 1.0 }],
    ]),
    buildStroke([
      [{ x: 0.2, y: 0.5 }, { x: 0.3, y: 0.35 }, { x: 0.6, y: 0.3 }, { x: 0.8, y: 0.45 }],
      [{ x: 0.8, y: 0.45 }, { x: 0.85, y: 0.55 }, { x: 0.8, y: 0.75 }, { x: 0.8, y: 1.0 }],
    ]),
  ],
  i: [
    polyStroke([{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.22 }]),
    buildStroke([
      [{ x: 0.5, y: 0.4 }, { x: 0.5, y: 0.6 }, { x: 0.5, y: 0.8 }, { x: 0.5, y: 1.0 }],
    ]),
  ],
  j: [
    polyStroke([{ x: 0.6, y: 0.2 }, { x: 0.6, y: 0.22 }]),
    buildStroke([
      [{ x: 0.6, y: 0.4 }, { x: 0.6, y: 0.7 }, { x: 0.6, y: 1.05 }, { x: 0.6, y: 1.2 }],
      [{ x: 0.6, y: 1.2 }, { x: 0.55, y: 1.35 }, { x: 0.3, y: 1.4 }, { x: 0.15, y: 1.3 }],
    ]),
  ],
  k: [
    buildStroke([
      [{ x: 0.2, y: 0.0 }, { x: 0.2, y: 0.3 }, { x: 0.2, y: 0.7 }, { x: 0.2, y: 1.0 }],
    ]),
    buildStroke([
      [{ x: 0.75, y: 0.35 }, { x: 0.55, y: 0.5 }, { x: 0.35, y: 0.6 }, { x: 0.2, y: 0.65 }],
    ]),
    buildStroke([
      [{ x: 0.3, y: 0.6 }, { x: 0.45, y: 0.7 }, { x: 0.6, y: 0.85 }, { x: 0.8, y: 1.0 }],
    ]),
  ],
  l: [
    buildStroke([
      [{ x: 0.5, y: 0.0 }, { x: 0.5, y: 0.3 }, { x: 0.5, y: 0.7 }, { x: 0.5, y: 1.0 }],
    ]),
  ],
  m: [
    buildStroke([
      [{ x: 0.1, y: 1.0 }, { x: 0.1, y: 0.7 }, { x: 0.1, y: 0.5 }, { x: 0.1, y: 0.4 }],
    ]),
    buildStroke([
      [{ x: 0.1, y: 0.5 }, { x: 0.15, y: 0.35 }, { x: 0.35, y: 0.3 }, { x: 0.45, y: 0.45 }],
      [{ x: 0.45, y: 0.45 }, { x: 0.5, y: 0.55 }, { x: 0.5, y: 0.75 }, { x: 0.5, y: 1.0 }],
    ]),
    buildStroke([
      [{ x: 0.5, y: 0.5 }, { x: 0.55, y: 0.35 }, { x: 0.75, y: 0.3 }, { x: 0.85, y: 0.45 }],
      [{ x: 0.85, y: 0.45 }, { x: 0.9, y: 0.55 }, { x: 0.9, y: 0.75 }, { x: 0.9, y: 1.0 }],
    ]),
  ],
  n: [
    buildStroke([
      [{ x: 0.2, y: 1.0 }, { x: 0.2, y: 0.7 }, { x: 0.2, y: 0.5 }, { x: 0.2, y: 0.4 }],
    ]),
    buildStroke([
      [{ x: 0.2, y: 0.5 }, { x: 0.3, y: 0.35 }, { x: 0.55, y: 0.3 }, { x: 0.75, y: 0.45 }],
      [{ x: 0.75, y: 0.45 }, { x: 0.85, y: 0.55 }, { x: 0.8, y: 0.75 }, { x: 0.8, y: 1.0 }],
    ]),
  ],
  o: [
    buildStroke([
      [{ x: 0.5, y: 0.3 }, { x: 0.2, y: 0.3 }, { x: 0.05, y: 0.55 }, { x: 0.05, y: 0.7 }],
      [{ x: 0.05, y: 0.7 }, { x: 0.05, y: 0.9 }, { x: 0.25, y: 1.05 }, { x: 0.5, y: 1.05 }],
      [{ x: 0.5, y: 1.05 }, { x: 0.75, y: 1.05 }, { x: 0.95, y: 0.9 }, { x: 0.95, y: 0.7 }],
      [{ x: 0.95, y: 0.7 }, { x: 0.95, y: 0.5 }, { x: 0.75, y: 0.3 }, { x: 0.5, y: 0.3 }],
    ]),
  ],
  p: [
    buildStroke([
      [{ x: 0.2, y: 0.4 }, { x: 0.2, y: 0.7 }, { x: 0.2, y: 1.0 }, { x: 0.2, y: 1.35 }],
    ]),
    buildStroke([
      [{ x: 0.2, y: 0.45 }, { x: 0.3, y: 0.3 }, { x: 0.65, y: 0.3 }, { x: 0.85, y: 0.5 }],
      [{ x: 0.85, y: 0.5 }, { x: 0.95, y: 0.65 }, { x: 0.85, y: 0.95 }, { x: 0.55, y: 1.0 }],
      [{ x: 0.55, y: 1.0 }, { x: 0.35, y: 1.0 }, { x: 0.2, y: 0.95 }, { x: 0.2, y: 0.85 }],
    ]),
  ],
  q: [
    buildStroke([
      [{ x: 0.8, y: 0.4 }, { x: 0.8, y: 0.7 }, { x: 0.8, y: 1.0 }, { x: 0.8, y: 1.35 }],
    ]),
    buildStroke([
      [{ x: 0.8, y: 0.45 }, { x: 0.7, y: 0.3 }, { x: 0.35, y: 0.3 }, { x: 0.15, y: 0.5 }],
      [{ x: 0.15, y: 0.5 }, { x: 0.0, y: 0.65 }, { x: 0.15, y: 0.95 }, { x: 0.45, y: 1.0 }],
      [{ x: 0.45, y: 1.0 }, { x: 0.65, y: 1.0 }, { x: 0.8, y: 0.95 }, { x: 0.8, y: 0.85 }],
    ]),
  ],
  r: [
    buildStroke([
      [{ x: 0.2, y: 0.4 }, { x: 0.2, y: 0.6 }, { x: 0.2, y: 0.8 }, { x: 0.2, y: 1.0 }],
    ]),
    buildStroke([
      [{ x: 0.2, y: 0.55 }, { x: 0.3, y: 0.4 }, { x: 0.5, y: 0.3 }, { x: 0.75, y: 0.35 }],
    ]),
  ],
  s: [
    buildStroke([
      [{ x: 0.8, y: 0.4 }, { x: 0.65, y: 0.3 }, { x: 0.35, y: 0.3 }, { x: 0.15, y: 0.45 }],
      [{ x: 0.15, y: 0.45 }, { x: 0.05, y: 0.55 }, { x: 0.3, y: 0.65 }, { x: 0.55, y: 0.7 }],
      [{ x: 0.55, y: 0.7 }, { x: 0.8, y: 0.75 }, { x: 0.95, y: 0.85 }, { x: 0.8, y: 0.95 }],
      [{ x: 0.8, y: 0.95 }, { x: 0.65, y: 1.05 }, { x: 0.35, y: 1.05 }, { x: 0.15, y: 0.95 }],
    ]),
  ],
  t: [
    buildStroke([
      [{ x: 0.45, y: 0.1 }, { x: 0.45, y: 0.4 }, { x: 0.45, y: 0.7 }, { x: 0.45, y: 0.9 }],
      [{ x: 0.45, y: 0.9 }, { x: 0.45, y: 1.0 }, { x: 0.55, y: 1.05 }, { x: 0.7, y: 1.0 }],
    ]),
    polyStroke([{ x: 0.15, y: 0.4 }, { x: 0.45, y: 0.4 }, { x: 0.75, y: 0.4 }]),
  ],
  u: [
    buildStroke([
      [{ x: 0.2, y: 0.4 }, { x: 0.2, y: 0.6 }, { x: 0.2, y: 0.85 }, { x: 0.3, y: 1.0 }],
      [{ x: 0.3, y: 1.0 }, { x: 0.45, y: 1.08 }, { x: 0.65, y: 1.0 }, { x: 0.8, y: 0.85 }],
    ]),
    buildStroke([
      [{ x: 0.8, y: 0.4 }, { x: 0.8, y: 0.6 }, { x: 0.8, y: 0.8 }, { x: 0.8, y: 1.0 }],
    ]),
  ],
  v: [
    buildStroke([
      [{ x: 0.15, y: 0.4 }, { x: 0.25, y: 0.6 }, { x: 0.4, y: 0.8 }, { x: 0.5, y: 1.0 }],
    ]),
    buildStroke([
      [{ x: 0.5, y: 1.0 }, { x: 0.6, y: 0.8 }, { x: 0.75, y: 0.6 }, { x: 0.85, y: 0.4 }],
    ]),
  ],
  w: [
    buildStroke([
      [{ x: 0.05, y: 0.4 }, { x: 0.1, y: 0.6 }, { x: 0.15, y: 0.8 }, { x: 0.25, y: 1.0 }],
    ]),
    buildStroke([
      [{ x: 0.25, y: 1.0 }, { x: 0.35, y: 0.75 }, { x: 0.4, y: 0.55 }, { x: 0.5, y: 0.5 }],
    ]),
    buildStroke([
      [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.75 }, { x: 0.65, y: 0.85 }, { x: 0.75, y: 1.0 }],
    ]),
    buildStroke([
      [{ x: 0.75, y: 1.0 }, { x: 0.8, y: 0.8 }, { x: 0.85, y: 0.6 }, { x: 0.95, y: 0.4 }],
    ]),
  ],
  x: [
    buildStroke([
      [{ x: 0.15, y: 0.4 }, { x: 0.3, y: 0.55 }, { x: 0.6, y: 0.85 }, { x: 0.85, y: 1.0 }],
    ]),
    buildStroke([
      [{ x: 0.85, y: 0.4 }, { x: 0.6, y: 0.6 }, { x: 0.35, y: 0.8 }, { x: 0.15, y: 1.0 }],
    ]),
  ],
  y: [
    buildStroke([
      [{ x: 0.15, y: 0.4 }, { x: 0.25, y: 0.6 }, { x: 0.35, y: 0.75 }, { x: 0.5, y: 0.85 }],
    ]),
    buildStroke([
      [{ x: 0.85, y: 0.4 }, { x: 0.75, y: 0.6 }, { x: 0.6, y: 0.85 }, { x: 0.5, y: 1.0 }],
      [{ x: 0.5, y: 1.0 }, { x: 0.4, y: 1.15 }, { x: 0.3, y: 1.3 }, { x: 0.15, y: 1.35 }],
    ]),
  ],
  z: [
    polyStroke([{ x: 0.15, y: 0.4 }, { x: 0.5, y: 0.4 }, { x: 0.85, y: 0.4 }]),
    buildStroke([
      [{ x: 0.85, y: 0.4 }, { x: 0.6, y: 0.6 }, { x: 0.4, y: 0.8 }, { x: 0.15, y: 1.0 }],
    ]),
    polyStroke([{ x: 0.15, y: 1.0 }, { x: 0.5, y: 1.0 }, { x: 0.85, y: 1.0 }]),
  ],
  ' ': [],
  '.': [polyStroke([{ x: 0.4, y: 0.95 }, { x: 0.45, y: 1.0 }, { x: 0.4, y: 1.0 }])],
  ',': [
    buildStroke([
      [{ x: 0.45, y: 0.95 }, { x: 0.45, y: 1.0 }, { x: 0.4, y: 1.1 }, { x: 0.35, y: 1.15 }],
    ]),
  ],
  '!': [
    buildStroke([
      [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.3 }, { x: 0.5, y: 0.55 }, { x: 0.5, y: 0.75 }],
    ]),
    polyStroke([{ x: 0.5, y: 0.95 }, { x: 0.5, y: 1.0 }]),
  ],
  '?': [
    buildStroke([
      [{ x: 0.2, y: 0.2 }, { x: 0.25, y: 0.05 }, { x: 0.6, y: 0.0 }, { x: 0.75, y: 0.15 }],
      [{ x: 0.75, y: 0.15 }, { x: 0.9, y: 0.3 }, { x: 0.7, y: 0.5 }, { x: 0.5, y: 0.55 }],
      [{ x: 0.5, y: 0.55 }, { x: 0.5, y: 0.6 }, { x: 0.5, y: 0.7 }, { x: 0.5, y: 0.75 }],
    ]),
    polyStroke([{ x: 0.5, y: 0.95 }, { x: 0.5, y: 1.0 }]),
  ],
  "'": [
    buildStroke([
      [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.15 }, { x: 0.45, y: 0.25 }, { x: 0.4, y: 0.3 }],
    ]),
  ],
  '-': [
    polyStroke([{ x: 0.15, y: 0.65 }, { x: 0.5, y: 0.65 }, { x: 0.85, y: 0.65 }]),
  ],
  ':': [
    polyStroke([{ x: 0.5, y: 0.45 }, { x: 0.5, y: 0.48 }]),
    polyStroke([{ x: 0.5, y: 0.92 }, { x: 0.5, y: 0.95 }]),
  ],
  ';': [
    polyStroke([{ x: 0.5, y: 0.45 }, { x: 0.5, y: 0.48 }]),
    buildStroke([
      [{ x: 0.5, y: 0.92 }, { x: 0.5, y: 0.97 }, { x: 0.45, y: 1.05 }, { x: 0.4, y: 1.1 }],
    ]),
  ],
  '(': [
    buildStroke([
      [{ x: 0.7, y: 0.1 }, { x: 0.4, y: 0.3 }, { x: 0.3, y: 0.6 }, { x: 0.3, y: 0.7 }],
      [{ x: 0.3, y: 0.7 }, { x: 0.3, y: 0.85 }, { x: 0.4, y: 1.0 }, { x: 0.7, y: 1.15 }],
    ]),
  ],
  ')': [
    buildStroke([
      [{ x: 0.3, y: 0.1 }, { x: 0.6, y: 0.3 }, { x: 0.7, y: 0.6 }, { x: 0.7, y: 0.7 }],
      [{ x: 0.7, y: 0.7 }, { x: 0.7, y: 0.85 }, { x: 0.6, y: 1.0 }, { x: 0.3, y: 1.15 }],
    ]),
  ],
  '"': [
    buildStroke([
      [{ x: 0.35, y: 0.1 }, { x: 0.35, y: 0.15 }, { x: 0.3, y: 0.25 }, { x: 0.28, y: 0.3 }],
    ]),
    buildStroke([
      [{ x: 0.65, y: 0.1 }, { x: 0.65, y: 0.15 }, { x: 0.6, y: 0.25 }, { x: 0.58, y: 0.3 }],
    ]),
  ],
};

// Map uppercase to lowercase
for (let c = 65; c <= 90; c++) {
  const upper = String.fromCharCode(c);
  const lower = String.fromCharCode(c + 32);
  if (letterPaths[lower]) {
    letterPaths[upper] = letterPaths[lower];
  }
}

// Digits
const digitPaths = {
  '0': [buildStroke([[{x:0.5,y:0.15},{x:0.15,y:0.15},{x:0.05,y:0.5},{x:0.05,y:0.7}],[{x:0.05,y:0.7},{x:0.05,y:0.9},{x:0.2,y:1.05},{x:0.5,y:1.05}],[{x:0.5,y:1.05},{x:0.8,y:1.05},{x:0.95,y:0.9},{x:0.95,y:0.7}],[{x:0.95,y:0.7},{x:0.95,y:0.5},{x:0.8,y:0.15},{x:0.5,y:0.15}]])],
  '1': [polyStroke([{x:0.35,y:0.3},{x:0.5,y:0.15},{x:0.5,y:1.0}]),polyStroke([{x:0.3,y:1.0},{x:0.7,y:1.0}])],
  '2': [buildStroke([[{x:0.15,y:0.3},{x:0.2,y:0.15},{x:0.5,y:0.1},{x:0.75,y:0.2}],[{x:0.75,y:0.2},{x:0.95,y:0.35},{x:0.7,y:0.6},{x:0.45,y:0.75}],[{x:0.45,y:0.75},{x:0.25,y:0.85},{x:0.15,y:0.95},{x:0.15,y:1.0}]]),polyStroke([{x:0.15,y:1.0},{x:0.5,y:1.0},{x:0.85,y:1.0}])],
  '3': [buildStroke([[{x:0.15,y:0.2},{x:0.35,y:0.1},{x:0.7,y:0.1},{x:0.8,y:0.3}],[{x:0.8,y:0.3},{x:0.85,y:0.45},{x:0.6,y:0.55},{x:0.45,y:0.55}]]),buildStroke([[{x:0.45,y:0.55},{x:0.65,y:0.55},{x:0.85,y:0.7},{x:0.8,y:0.85}],[{x:0.8,y:0.85},{x:0.75,y:1.0},{x:0.4,y:1.05},{x:0.15,y:0.95}]])],
  '4': [polyStroke([{x:0.7,y:0.15},{x:0.15,y:0.65},{x:0.85,y:0.65}]),buildStroke([[{x:0.65,y:0.15},{x:0.65,y:0.5},{x:0.65,y:0.75},{x:0.65,y:1.0}]])],
  '5': [polyStroke([{x:0.75,y:0.15},{x:0.25,y:0.15},{x:0.2,y:0.5}]),buildStroke([[{x:0.2,y:0.5},{x:0.45,y:0.4},{x:0.75,y:0.5},{x:0.85,y:0.7}],[{x:0.85,y:0.7},{x:0.9,y:0.85},{x:0.65,y:1.05},{x:0.35,y:1.05}],[{x:0.35,y:1.05},{x:0.2,y:1.0},{x:0.15,y:0.95},{x:0.15,y:0.9}]])],
  '6': [buildStroke([[{x:0.7,y:0.2},{x:0.55,y:0.1},{x:0.3,y:0.15},{x:0.15,y:0.35}],[{x:0.15,y:0.35},{x:0.05,y:0.5},{x:0.05,y:0.7},{x:0.1,y:0.85}],[{x:0.1,y:0.85},{x:0.2,y:1.05},{x:0.55,y:1.05},{x:0.75,y:0.85}],[{x:0.75,y:0.85},{x:0.85,y:0.7},{x:0.7,y:0.5},{x:0.45,y:0.5}],[{x:0.45,y:0.5},{x:0.25,y:0.5},{x:0.1,y:0.6},{x:0.1,y:0.75}]])],
  '7': [polyStroke([{x:0.15,y:0.15},{x:0.5,y:0.15},{x:0.85,y:0.15}]),buildStroke([[{x:0.85,y:0.15},{x:0.7,y:0.4},{x:0.55,y:0.7},{x:0.45,y:1.0}]])],
  '8': [buildStroke([[{x:0.5,y:0.55},{x:0.25,y:0.5},{x:0.15,y:0.35},{x:0.25,y:0.2}],[{x:0.25,y:0.2},{x:0.35,y:0.1},{x:0.65,y:0.1},{x:0.75,y:0.2}],[{x:0.75,y:0.2},{x:0.85,y:0.35},{x:0.75,y:0.5},{x:0.5,y:0.55}]]),buildStroke([[{x:0.5,y:0.55},{x:0.2,y:0.6},{x:0.05,y:0.8},{x:0.2,y:0.95}],[{x:0.2,y:0.95},{x:0.35,y:1.05},{x:0.65,y:1.05},{x:0.8,y:0.95}],[{x:0.8,y:0.95},{x:0.95,y:0.8},{x:0.8,y:0.6},{x:0.5,y:0.55}]])],
  '9': [buildStroke([[{x:0.8,y:0.55},{x:0.65,y:0.55},{x:0.3,y:0.5},{x:0.2,y:0.35}],[{x:0.2,y:0.35},{x:0.15,y:0.2},{x:0.35,y:0.1},{x:0.55,y:0.1}],[{x:0.55,y:0.1},{x:0.75,y:0.1},{x:0.9,y:0.25},{x:0.85,y:0.45}],[{x:0.85,y:0.45},{x:0.8,y:0.6},{x:0.75,y:0.8},{x:0.55,y:1.0}],[{x:0.55,y:1.0},{x:0.4,y:1.05},{x:0.25,y:1.0},{x:0.2,y:0.9}]])],
};
Object.assign(letterPaths, digitPaths);

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Get the array of strokes for a single character.
 * @param {string} char
 * @param {number} originX
 * @param {number} originY
 * @param {number} fontSize
 * @returns {Array<Array<{x:number,y:number}>>}
 */
export function getLetterStrokes(char, originX, originY, fontSize = 48) {
  const paths = letterPaths[char];
  if (!paths || paths.length === 0) return [];

  const scale = fontSize / 1.4;
  const width = scale * 1.0;

  return paths.map((stroke) =>
    stroke.map((pt) => ({
      x: originX + pt.x * width,
      y: originY + pt.y * scale,
    }))
  );
}

/**
 * Get all strokes for a text string, with automatic line wrapping.
 * Unknown characters are skipped gracefully with cursor advancement.
 * @param {string} text
 * @param {number} startX
 * @param {number} startY
 * @param {number} fontSize
 * @param {number} canvasWidth
 * @returns {{ strokes: Array<Array<{x:number,y:number}>>, charBoundaries: number[], text: string }}
 */
export function getTextStrokes(text, startX, startY, fontSize = 48, canvasWidth = 1920) {
  const scale = fontSize / 1.4;
  const letterWidth = scale * 1.0;
  const kerning = 4;
  const lineHeight = fontSize * 1.3;
  const rightMargin = canvasWidth - 60;

  let cursorX = startX;
  let cursorY = startY;
  const allStrokes = [];
  const charBoundaries = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    // Line wrap check
    if (cursorX + letterWidth > rightMargin && ch !== ' ') {
      cursorX = startX;
      cursorY += lineHeight;
    }

    charBoundaries.push(allStrokes.length);

    if (ch === ' ') {
      // Space — just advance cursor
      cursorX += letterWidth * 0.5 + kerning;
      continue;
    }

    const letterStrokes = getLetterStrokes(ch, cursorX, cursorY, fontSize);

    if (letterStrokes.length === 0) {
      // Unknown character — skip but still advance cursor so text doesn't pile up
      cursorX += letterWidth * 0.4 + kerning;
      continue;
    }

    for (const s of letterStrokes) {
      allStrokes.push(s);
    }

    cursorX += letterWidth + kerning;
  }

  return { strokes: allStrokes, charBoundaries, text, endCursorX: cursorX, endCursorY: cursorY };
}

/**
 * Animate handwritten text onto a Konva layer, drawing stroke by stroke.
 * REWRITTEN: Uses simple sequential setTimeout-based approach to avoid
 * infinite loops from the distance-budget rAF pattern.
 *
 * @param {Object|Function} layerOrGetter - Konva.Layer or function that returns one
 * @param {Array<Array<{x:number,y:number}>>} strokes
 * @param {string} color
 * @param {number} brushSize
 * @param {Function} onComplete
 * @param {Function} [onStrokeCreated]
 * @returns {{ cancel: Function }}
 */
export function animateHandwriting(layerOrGetter, strokes, color, brushSize = 4, onComplete, onStrokeCreated) {
  let cancelled = false;
  let strokeIdx = 0;
  let rafHandle = null;

  function getLayer() {
    if (typeof layerOrGetter === 'function') return layerOrGetter();
    return layerOrGetter;
  }

  function drawNextStroke() {
    if (cancelled) return;
    if (strokeIdx >= strokes.length) {
      if (onComplete) onComplete();
      return;
    }

    const stroke = strokes[strokeIdx];
    strokeIdx++;

    // Skip empty or single-point strokes
    if (!stroke || stroke.length < 2) {
      setTimeout(drawNextStroke, 10);
      return;
    }

    const layer = getLayer();
    if (!layer) {
      // Layer not available — retry in 100ms
      strokeIdx--;
      setTimeout(drawNextStroke, 100);
      return;
    }

    const id = generateStrokeId();
    const flatAllPoints = [];
    for (const pt of stroke) {
      flatAllPoints.push(pt.x, pt.y);
    }

    const line = new Konva.Line({
      id,
      points: [stroke[0].x, stroke[0].y],
      stroke: color,
      strokeWidth: brushSize,
      lineCap: 'round',
      lineJoin: 'round',
      tension: 0.4,
    });
    layer.add(line);

    // Notify about the complete stroke (for WebRTC sync)
    if (onStrokeCreated) {
      onStrokeCreated(line, id, stroke);
    }

    // Animate points incrementally
    let ptIdx = 1;
    const drawnPoints = [stroke[0].x, stroke[0].y];
    const POINTS_PER_FRAME = 2; // draw 2 points per frame for speed

    function animatePoints() {
      if (cancelled) return;

      // Draw a batch of points per frame
      for (let b = 0; b < POINTS_PER_FRAME && ptIdx < stroke.length; b++) {
        drawnPoints.push(stroke[ptIdx].x, stroke[ptIdx].y);
        ptIdx++;
      }

      line.points(drawnPoints);
      layer.batchDraw();

      if (ptIdx < stroke.length) {
        rafHandle = requestAnimationFrame(animatePoints);
      } else {
        // Stroke complete — pause then draw next
        // 20ms between strokes of same letter, effectively
        setTimeout(drawNextStroke, 15);
      }
    }

    rafHandle = requestAnimationFrame(animatePoints);
  }

  // Start the chain
  drawNextStroke();

  return {
    cancel: () => {
      cancelled = true;
      if (rafHandle) cancelAnimationFrame(rafHandle);
    },
  };
}
