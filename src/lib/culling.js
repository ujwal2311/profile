/**
 * culling.js — Viewport Culling for Infinite Canvas
 *
 * Only renders shapes within/near the visible viewport for performance.
 * Uses AABB intersection with a 100px buffer for smooth panning.
 */

/**
 * Compute bounding box of any stroke/shape object.
 * Handles both freehand strokes (points array) and shape objects.
 */
export function getShapeBounds(shape) {
  if (shape.shapeType === 'circle' && shape.shapeParams) {
    const { cx, cy, radius } = shape.shapeParams;
    return { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 };
  }
  if (shape.shapeType === 'rectangle' && shape.shapeParams) {
    const p = shape.shapeParams;
    return { x: p.x, y: p.y, w: p.width, h: p.height };
  }
  if (shape.shapeType === 'line' && shape.shapeParams) {
    const { x1, y1, x2, y2 } = shape.shapeParams;
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }
  if (shape.shapeType === 'triangle' && shape.shapeParams) {
    const verts = shape.shapeParams.vertices;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of verts) {
      if (v.x < minX) minX = v.x; if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x; if (v.y > maxY) maxY = v.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  // Freehand: compute from flat points
  const pts = shape.points;
  if (!pts || pts.length < 2) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length - 1; i += 2) {
    if (pts[i] < minX) minX = pts[i];
    if (pts[i + 1] < minY) minY = pts[i + 1];
    if (pts[i] > maxX) maxX = pts[i];
    if (pts[i + 1] > maxY) maxY = pts[i + 1];
  }
  const sw = (shape.size || 4) / 2;
  return { x: minX - sw, y: minY - sw, w: (maxX - minX) + sw * 2, h: (maxY - minY) + sw * 2 };
}

/**
 * Check if a shape intersects the viewport (with buffer).
 *
 * @param {Object} viewport — { x, y, scale } from Konva Stage position
 * @param {number} cW — viewport width in px
 * @param {number} cH — viewport height in px
 */
export function isVisible(shape, viewport, cW, cH) {
  const b = getShapeBounds(shape);
  const BUF = 100;
  const wL = (-viewport.x / viewport.scale) - BUF;
  const wT = (-viewport.y / viewport.scale) - BUF;
  const wR = wL + (cW / viewport.scale) + BUF * 2;
  const wB = wT + (cH / viewport.scale) + BUF * 2;
  return !(b.x + b.w < wL || b.x > wR || b.y + b.h < wT || b.y > wB);
}

/** Filter to only visible shapes. */
export function getVisibleShapes(all, viewport, cW, cH) {
  if (!all || all.length === 0) return [];
  return all.filter(s => isVisible(s, viewport, cW, cH));
}
