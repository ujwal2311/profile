/**
 * WhiteboardCanvas.jsx — Konva Canvas with Shape Rendering + Culling
 *
 * Renders freehand strokes as Konva.Line, detected shapes as native Konva
 * shapes (Circle, Rect, Line, Ellipse). Supports viewport culling, pinch zoom,
 * Figma-style spacebar pan, shape snap visual feedback, and drag-to-draw
 * shape preview.
 *
 * Layer order (bottom to top):
 *   1. Background layer (static white / loaded image)
 *   2. Remote strokes layer (listening: false for perf)
 *   3. Local strokes layer
 *   4. Shapes layer (rect/circle/line — local + remote)
 *   5. Preview layer (shape drag preview — cleared after mouseup)
 *   6. Active drawing layer (current stroke being drawn)
 */

import React, { useEffect, useState, useMemo, Component } from 'react';
import { Stage, Layer, Line, Circle, Rect, Ellipse, Image as KonvaImage, Text } from 'react-konva';

/* ── Error Boundary ──────────────────────────────────── */
class CanvasErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[CanvasErrorBoundary]', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#141414', color: '#9CA3AF', fontFamily: 'Inter, system-ui, sans-serif', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 48 }}>🎨</div>
          <p style={{ fontSize: 14 }}>Canvas encountered an error</p>
          <pre style={{ fontSize: 11, color: '#666', maxWidth: '80%', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{this.state.error?.message}</pre>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ padding: '8px 20px', borderRadius: 8, backgroundColor: '#FACC15', color: '#0A0A0A', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 13 }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Stroke Renderer ────────────────────────────────── */
function StrokeLine({ stroke }) {
  if (!stroke) return null;
  const isEraser = stroke.tool === 'eraser';
  return (
    <Line
      id={stroke.id}
      points={stroke.points}
      stroke={isEraser ? '#000000' : stroke.color}
      strokeWidth={stroke.size}
      tension={0.5}
      lineCap="round"
      lineJoin="round"
      globalCompositeOperation={isEraser ? 'destination-out' : 'source-over'}
    />
  );
}

/* ── Shape Renderer (Smart Shapes from pen recognition) ─── */
function ShapeNode({ shape }) {
  if (!shape || !shape.shapeType || !shape.shapeParams) return null;
  const { shapeType, shapeParams, color, size } = shape;

  switch (shapeType) {
    case 'circle':
      return <Circle id={shape.id} x={shapeParams.cx} y={shapeParams.cy} radius={shapeParams.radius} stroke={color} strokeWidth={size} />;
    case 'rectangle':
      return <Rect id={shape.id} x={shapeParams.x} y={shapeParams.y} width={shapeParams.width} height={shapeParams.height} stroke={color} strokeWidth={size} />;
    case 'line':
      return <Line id={shape.id} points={[shapeParams.x1, shapeParams.y1, shapeParams.x2, shapeParams.y2]} stroke={color} strokeWidth={size} lineCap="round" />;
    case 'triangle': {
      const verts = shapeParams.vertices;
      if (!verts || verts.length < 3) return null;
      const pts = verts.flatMap(v => [v.x, v.y]);
      return <Line id={shape.id} points={pts} closed stroke={color} strokeWidth={size} lineCap="round" lineJoin="round" />;
    }
    default:
      return null;
  }
}

/* ── Drag-to-Draw Shape Renderer ────────────────────── */
function DragShape({ shape }) {
  if (!shape) return null;
  if (shape.shapeType === 'rect') {
    return (
      <Rect
        id={shape.id}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        stroke={shape.color}
        strokeWidth={shape.size}
        fill="transparent"
      />
    );
  }
  if (shape.shapeType === 'circle') {
    return (
      <Ellipse
        id={shape.id}
        x={shape.centerX}
        y={shape.centerY}
        radiusX={shape.radiusX}
        radiusY={shape.radiusY}
        stroke={shape.color}
        strokeWidth={shape.size}
        fill="transparent"
      />
    );
  }
  return null;
}

/* ── Stroke or Shape dispatcher ──────────────────────── */
function StrokeOrShape({ stroke }) {
  if (stroke.shapeType && stroke.shapeParams) return <ShapeNode shape={stroke} />;
  return <StrokeLine stroke={stroke} />;
}

/* ── Shape Preview (dashed outline while dragging) ───── */
function ShapePreview({ data, color }) {
  if (!data) return null;

  if (data.type === 'rect') {
    return (
      <Rect
        x={data.x}
        y={data.y}
        width={data.width}
        height={data.height}
        stroke={color}
        strokeWidth={2}
        dash={[6, 3]}
        fill="transparent"
      />
    );
  }
  if (data.type === 'circle') {
    return (
      <Ellipse
        x={data.centerX}
        y={data.centerY}
        radiusX={data.radiusX}
        radiusY={data.radiusY}
        stroke={color}
        strokeWidth={2}
        dash={[6, 3]}
        fill="transparent"
      />
    );
  }
  return null;
}

/* ── Main Component ─────────────────────────────────── */
export default function WhiteboardCanvas({
  stageRef, width, height,
  strokes, remoteStrokes, currentStroke, remoteCurrentStroke,
  shapes, remoteShapes, shapePreviewData, currentColor,
  stageScale, stagePos, setStagePos,
  onMouseDown, onMouseMove, onMouseUp, onWheel,
  onTouchMove, onTouchEnd,
  onMiddleMousePan, onPanEnd, isPanning,
  backgroundDataURL,
  shapeSnapFeedback,
  getVisibleLocal, getVisibleRemote,
  roomId,
}) {
  const [bgImage, setBgImage] = useState(null);

  useEffect(() => {
    if (!backgroundDataURL) { setBgImage(null); return; }
    const img = new window.Image();
    img.onload = () => setBgImage(img);
    img.onerror = () => setBgImage(null);
    img.src = backgroundDataURL;
  }, [backgroundDataURL]);

  // Viewport-culled strokes
  const visLocal = useMemo(
    () => getVisibleLocal ? getVisibleLocal(width, height) : strokes,
    [getVisibleLocal, width, height, strokes]
  );
  const visRemote = useMemo(
    () => getVisibleRemote ? getVisibleRemote(width, height) : remoteStrokes,
    [getVisibleRemote, width, height, remoteStrokes]
  );

  const cursorStyle = isPanning ? 'grab' : 'crosshair';

  return (
    <CanvasErrorBoundary>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={false}
        onMouseDown={(e) => {
          if (e.evt.button === 1 || isPanning) { onMiddleMousePan?.(e); return; }
          onMouseDown?.(e);
        }}
        onMouseMove={(e) => {
          if (e.evt.buttons === 4 || isPanning) { onMiddleMousePan?.(e); return; }
          onMouseMove?.(e);
        }}
        onMouseUp={(e) => { onPanEnd?.(); onMouseUp?.(e); }}
        onMouseLeave={(e) => { onPanEnd?.(); onMouseUp?.(e); }}
        onTouchStart={onMouseDown}
        onTouchMove={(e) => {
          if (e.evt.touches && e.evt.touches.length > 1) { onTouchMove?.(e); }
          else { onMouseMove?.(e); }
        }}
        onTouchEnd={(e) => { onTouchEnd?.(e); onMouseUp?.(e); }}
        onWheel={onWheel}
        style={{ cursor: cursorStyle, touchAction: 'none' }}
      >
        {/* Layer 1: Background */}
        <Layer listening={false}>
          {bgImage && <KonvaImage image={bgImage} x={0} y={0} width={bgImage.width} height={bgImage.height} />}
        </Layer>

        {/* Layer 2: Remote strokes (listening disabled for perf) */}
        <Layer listening={false}>
          {(visRemote || []).map((s) => <StrokeOrShape key={s.id} stroke={s} />)}
        </Layer>

        {/* Layer 3: Local strokes */}
        <Layer listening={false}>
          {(visLocal || []).map((s) => <StrokeOrShape key={s.id} stroke={s} />)}
        </Layer>

        {/* Layer 4: Shapes — drag-to-draw (local + remote) */}
        <Layer listening={false}>
          {(shapes || []).map((s) => <DragShape key={s.id} shape={s} />)}
          {(remoteShapes || []).map((s) => <DragShape key={s.id} shape={s} />)}
        </Layer>

        {/* Layer 5: Preview (shape drag preview) */}
        <Layer listening={false}>
          <ShapePreview data={shapePreviewData} color={currentColor || '#FACC15'} />
        </Layer>

        {/* Layer 6: Active drawing + remote current stroke */}
        <Layer>
          {currentStroke && currentStroke.points && currentStroke.points.length >= 2 && (
            <StrokeLine stroke={currentStroke} />
          )}
          {remoteCurrentStroke && remoteCurrentStroke.points && remoteCurrentStroke.points.length >= 2 && (
            <StrokeLine stroke={remoteCurrentStroke} />
          )}
        </Layer>
      </Stage>

      {/* Shape snap feedback — green checkmark overlay */}
      {shapeSnapFeedback && (
        <div
          className="absolute z-30 pointer-events-none animate-fade-in"
          style={{
            left: shapeSnapFeedback.x * stageScale + stagePos.x - 16,
            top: shapeSnapFeedback.y * stageScale + stagePos.y - 16,
          }}
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-lg animate-shape-snap">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-emerald-400 text-[10px] font-medium text-center mt-1 whitespace-nowrap">
            {shapeSnapFeedback.shape}
          </div>
        </div>
      )}
    </CanvasErrorBoundary>
  );
}
