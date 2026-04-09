/**
 * shapeRecognizer.js — AI-Powered Smart Shape Recognition
 *
 * Pure math-based detection (no ML). Analyzes freehand points and classifies
 * as circle, rectangle, triangle, line, or null (keep freeform).
 *
 * All functions accept flat [x1,y1,x2,y2,...] arrays from Konva.
 *
 * IMPORTANT: detectShape() only runs when activeTool === 'pen'.
 * Shape tools (rect, circle) use drag-to-draw and must not trigger recognition.
 */

/* ── Helpers ─────────────────────────────────────────── */

/**
 * Convert flat [x1,y1,x2,y2,...] to [{x,y},...] array.
 * @param {number[]} flat
 * @returns {{x:number,y:number}[]}
 */
export function flatToPoints(flat) {
  const pts = [];
  for (let i = 0; i < flat.length - 1; i += 2) {
    pts.push({ x: flat[i], y: flat[i + 1] });
  }
  return pts;
}

/**
 * Get bounding box of points array.
 * @param {{x:number,y:number}[]} points
 * @returns {{x:number,y:number,width:number,height:number,centerX:number,centerY:number}}
 */
export function getBoundingBox(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX, h = maxY - minY;
  return { x: minX, y: minY, width: w, height: h, centerX: minX + w / 2, centerY: minY + h / 2 };
}

/**
 * Least-squares circle fit.
 * Centroid = approximate center, radius = mean distance from centroid.
 * @param {{x:number,y:number}[]} points
 * @returns {{cx:number,cy:number,radius:number}}
 */
export function getCircleFromPoints(points) {
  const n = points.length;
  if (n === 0) return { cx: 0, cy: 0, radius: 0 };
  let cx = 0, cy = 0;
  for (const p of points) { cx += p.x; cy += p.y; }
  cx /= n; cy /= n;
  let totalDist = 0;
  for (const p of points) {
    totalDist += Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
  }
  return { cx, cy, radius: totalDist / n };
}

/**
 * Get rectangle params from points bounding box.
 * @param {{x:number,y:number}[]} points
 * @returns {{x:number,y:number,width:number,height:number}}
 */
export function getRectFromPoints(points) {
  const bb = getBoundingBox(points);
  return { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
}

/**
 * Get line params from first and last points.
 * @param {{x:number,y:number}[]} points
 * @returns {{x1:number,y1:number,x2:number,y2:number}}
 */
export function getLineFromPoints(points) {
  if (points.length < 2) return { x1: 0, y1: 0, x2: 0, y2: 0 };
  const f = points[0], l = points[points.length - 1];
  return { x1: f.x, y1: f.y, x2: l.x, y2: l.y };
}

/**
 * Get triangle vertices from points.
 * @param {{x:number,y:number}[]} points
 * @returns {{x:number,y:number}[]}
 */
export function getTriangleFromPoints(points) {
  const corners = findCorners(points, 3);
  if (corners.length >= 3) return corners.slice(0, 3);
  const mid = Math.floor(points.length / 2);
  return [points[0], points[mid], points[points.length - 1]];
}

/* ── Internal math ───────────────────────────────────── */

function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.sqrt((points[i].x - points[i - 1].x) ** 2 + (points[i].y - points[i - 1].y) ** 2);
  }
  return len;
}

function closureDistance(points) {
  if (points.length < 2) return Infinity;
  const f = points[0], l = points[points.length - 1];
  return Math.sqrt((f.x - l.x) ** 2 + (f.y - l.y) ** 2);
}

/** Closed if end-start gap < 15% of total path length */
function isClosed(points) {
  const pLen = pathLength(points);
  if (pLen < 20) return false;
  return closureDistance(points) / pLen < 0.15;
}

/** Circle: closed loop with uniform radius (stddev < 20% of mean radius) */
function isCircle(points) {
  if (points.length < 12 || !isClosed(points)) return false;
  const { cx, cy, radius } = getCircleFromPoints(points);
  if (radius < 10) return false;
  let sumSqDiff = 0;
  for (const p of points) {
    const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
    sumSqDiff += (dist - radius) ** 2;
  }
  return Math.sqrt(sumSqDiff / points.length) / radius < 0.20;
}

/** Linear regression R² — checks both y-on-x and x-on-y for near-vertical lines */
function linearRegressionR2(points) {
  const n = points.length;
  if (n < 3) return 0;
  let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
  for (const p of points) {
    sumX += p.x; sumY += p.y;
    sumXX += p.x * p.x; sumYY += p.y * p.y;
    sumXY += p.x * p.y;
  }
  const meanX = sumX / n, meanY = sumY / n;

  // y-on-x regression
  const denomX = n * sumXX - sumX * sumX;
  if (Math.abs(denomX) > 0.001) {
    const slope = (n * sumXY - sumX * sumY) / denomX;
    const intercept = (sumY - slope * sumX) / n;
    let ssRes = 0, ssTot = 0;
    for (const p of points) {
      ssRes += (p.y - (slope * p.x + intercept)) ** 2;
      ssTot += (p.y - meanY) ** 2;
    }
    if (ssTot > 0 && (1 - ssRes / ssTot) > 0.95) return 1 - ssRes / ssTot;
  }

  // x-on-y regression (for near-vertical lines)
  const denomY = n * sumYY - sumY * sumY;
  if (Math.abs(denomY) > 0.001) {
    const slope = (n * sumXY - sumX * sumY) / denomY;
    const intercept = (sumX - slope * sumY) / n;
    let ssRes = 0, ssTot = 0;
    for (const p of points) {
      ssRes += (p.x - (slope * p.y + intercept)) ** 2;
      ssTot += (p.x - meanX) ** 2;
    }
    if (ssTot > 0) return 1 - ssRes / ssTot;
  }
  return 0;
}

function isLine(points) {
  if (points.length < 3 || isClosed(points)) return false;
  const bb = getBoundingBox(points);
  if (Math.sqrt(bb.width ** 2 + bb.height ** 2) < 20) return false;
  return linearRegressionR2(points) > 0.97;
}

/** Angle-based corner detection with merging */
function findCorners(points, _expected) {
  if (points.length < 5) return [];
  const n = points.length;
  const WIN = Math.max(3, Math.floor(n * 0.08));
  const raw = [];
  for (let i = WIN; i < n - WIN; i++) {
    const prev = points[i - WIN], curr = points[i], next = points[i + WIN];
    const v1x = curr.x - prev.x, v1y = curr.y - prev.y;
    const v2x = next.x - curr.x, v2y = next.y - curr.y;
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    if (len1 < 1 || len2 < 1) continue;
    const cos = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
    if (angle > 50 && angle < 150) raw.push({ x: curr.x, y: curr.y, angle, index: i });
  }
  // Merge nearby corners
  const minDist = pathLength(points) * 0.1;
  const merged = [];
  for (const c of raw) {
    let tooClose = false;
    for (const m of merged) {
      if (Math.sqrt((c.x - m.x) ** 2 + (c.y - m.y) ** 2) < minDist) {
        tooClose = true;
        if (Math.abs(c.angle - 90) < Math.abs(m.angle - 90)) Object.assign(m, c);
        break;
      }
    }
    if (!tooClose) merged.push({ ...c });
  }
  return merged;
}

function isRectangle(points) {
  if (points.length < 12 || !isClosed(points)) return false;
  const corners = findCorners(points, 4);
  if (corners.length !== 4) return false;
  return corners.every(c => Math.abs(c.angle - 90) < 25);
}

function isTriangle(points) {
  if (points.length < 8 || !isClosed(points)) return false;
  return findCorners(points, 3).length === 3;
}

/* ── Main entry point ────────────────────────────────── */

/**
 * Detect shape from flat [x1,y1,x2,y2,...] points array.
 *
 * GUARD: Only runs when activeTool === 'pen'. Shape tools (rect, circle)
 * use drag-to-draw and must never trigger smart shape recognition.
 * This guard is the fix for the triangle false-positive bug.
 *
 * @param {number[]} flatPoints - Flat points array from Konva
 * @param {string} activeTool - Currently active tool name
 * @returns {'circle'|'rectangle'|'triangle'|'line'|null}
 */
export function detectShape(flatPoints, activeTool) {
  // GUARD: Only analyze freehand pen strokes
  if (activeTool !== 'pen') return null;

  const points = flatToPoints(flatPoints);
  if (points.length < 5) return null;
  if (isLine(points)) return 'line';
  if (isCircle(points)) return 'circle';
  if (isRectangle(points)) return 'rectangle';
  if (isTriangle(points)) return 'triangle';
  return null;
}
