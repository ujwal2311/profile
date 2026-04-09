/**
 * useCanvas.js — Konva Canvas Drawing Engine (Full Upgrade)
 *
 * Features:
 *   - Freehand pen/eraser drawing with speed-based width
 *   - Shape tools: line, rect, circle (drag-to-draw — clean and accurate)
 *   - Smart Shape Recognition: auto-snap freehand → perfect geometry (pen tool ONLY)
 *   - Pinch-to-zoom, scroll-to-zoom, pan
 *   - Undo stack (50 levels)
 *   - WebRTC sync via sendData/onData
 *   - Viewport culling integration
 *   - Voice-to-handwriting integration
 *   - Unique IDs for all elements via idGenerator
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { MSG, drawStroke, drawShape, drawStart, drawMove, drawEnd, clearMsg, undoMsg, cursorMove, handwritingStrokeMsg } from '../lib/protocol';
import { detectShape, flatToPoints, getCircleFromPoints, getRectFromPoints, getLineFromPoints, getTriangleFromPoints } from '../lib/shapeRecognizer';
import { getVisibleShapes } from '../lib/culling';
import { generateStrokeId, generateShapeId } from '../lib/idGenerator';

const MAX_UNDO = 50;

/**
 * @param {Object} opts
 * @param {React.RefObject} opts.stageRef - Konva Stage ref
 * @param {Function} opts.sendData - WebRTC send function
 * @param {Function} opts.onData - WebRTC receive callback registrar
 * @param {string} opts.myPeerId - Local peer ID
 * @param {string} opts.roomId - Room ID for persistence
 * @param {Function} opts.triggerDebouncedSave - Persistence save trigger
 * @returns {Object} Canvas state and handlers
 */
export default function useCanvas({ stageRef, sendData, onData, myPeerId, roomId, triggerDebouncedSave }) {
  // Strokes
  const [strokes, setStrokes] = useState([]);
  const [remoteStrokes, setRemoteStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [remoteCurrentStroke, setRemoteCurrentStroke] = useState(null);

  // Shapes (drag-to-draw)
  const [shapes, setShapes] = useState([]);
  const [remoteShapes, setRemoteShapes] = useState([]);

  // Undo
  const undoStack = useRef([]);

  // Drawing state
  const isDrawing = useRef(false);
  const lastPointTime = useRef(0);
  const lastPointPos = useRef({ x: 0, y: 0 });

  // Shape drag-to-draw state
  const isDrawingShape = useRef(false);
  const shapeStart = useRef(null);
  const previewNodeRef = useRef(null);
  const shiftHeldRef = useRef(false);

  // Tools & settings
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#FACC15');
  const [brushSize, setBrushSize] = useState(4);

  // Smart shapes
  const [smartShapes, setSmartShapes] = useState(true);
  const [shapeSnapFeedback, setShapeSnapFeedback] = useState(null);

  // Remote cursor
  const [remoteCursor, setRemoteCursor] = useState(null);
  const cursorTimer = useRef(null);

  // Zoom & pan
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Spacebar pan (Figma-style)
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);

  // rAF throttle
  const rafId = useRef(null);
  const pendingMoves = useRef([]);

  // Track shift key for constrained shapes
  useEffect(() => {
    const down = (e) => { if (e.key === 'Shift') shiftHeldRef.current = true; };
    const up = (e) => { if (e.key === 'Shift') shiftHeldRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Speed-based brush size
  const getSpeedBasedSize = useCallback((x, y, baseSize) => {
    const now = Date.now();
    const dt = now - (lastPointTime.current || now);
    const dx = x - (lastPointPos.current?.x || x);
    const dy = y - (lastPointPos.current?.y || y);
    const speed = dt > 0 ? Math.sqrt(dx * dx + dy * dy) / dt : 0;
    lastPointTime.current = now;
    lastPointPos.current = { x, y };
    return baseSize * Math.max(0.5, Math.min(1.3, 1.3 - speed * 0.3));
  }, []);

  // Pointer position relative to stage (world coordinates)
  const getRelativePointerPosition = useCallback(() => {
    const stage = stageRef?.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return stage.getAbsoluteTransform().copy().invert().point(pos);
  }, [stageRef]);

  // ═══ FREEHAND DRAWING (pen/eraser) ═══

  const startDrawing = useCallback((e) => {
    const stage = stageRef?.current;
    if (!stage) return;
    if (e.evt?.touches?.length > 1) return;
    if (tool === 'voice') return; // voice handled in Room.jsx

    // Shape tools use drag-to-draw (handled separately)
    if (tool === 'rect' || tool === 'circle') {
      startShapeDraw(e);
      return;
    }

    isDrawing.current = true;
    const pos = getRelativePointerPosition();
    lastPointTime.current = Date.now();
    lastPointPos.current = pos;

    const id = generateStrokeId();
    const newStroke = {
      id,
      points: [pos.x, pos.y],
      color: tool === 'eraser' ? '#000000' : color,
      size: brushSize,
      tool,
    };

    undoStack.current.push({ strokes: [...strokes], shapes: [...shapes] });
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();

    setCurrentStroke(newStroke);
    sendData(drawStart(id, pos.x, pos.y, newStroke.color, brushSize, tool));
  }, [stageRef, getRelativePointerPosition, color, brushSize, tool, sendData, strokes, shapes]);

  const continueDrawing = useCallback(() => {
    // Handle shape drag
    if (isDrawingShape.current) {
      continueShapeDraw();
      return;
    }

    if (!isDrawing.current || !currentStroke) return;
    const pos = getRelativePointerPosition();
    const effectiveSize = getSpeedBasedSize(pos.x, pos.y, brushSize);

    setCurrentStroke((prev) => {
      if (!prev) return null;
      return { ...prev, points: [...prev.points, pos.x, pos.y], size: effectiveSize };
    });

    pendingMoves.current.push({ x: pos.x, y: pos.y });
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        pendingMoves.current.forEach((m) => sendData(drawMove(m.x, m.y)));
        pendingMoves.current = [];
        rafId.current = null;
      });
    }
    sendData(cursorMove(pos.x, pos.y, myPeerId));
  }, [currentStroke, getRelativePointerPosition, getSpeedBasedSize, brushSize, sendData, myPeerId]);

  const stopDrawing = useCallback(() => {
    // Handle shape drag end
    if (isDrawingShape.current) {
      stopShapeDraw();
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (currentStroke && currentStroke.points.length >= 4) {
      let finalStroke = { ...currentStroke };

      // Smart Shape Recognition — ONLY on pen tool
      if (smartShapes && tool === 'pen') {
        const detected = detectShape(currentStroke.points, tool);
        if (detected) {
          const pts = flatToPoints(currentStroke.points);
          let shapeParams;
          switch (detected) {
            case 'circle': shapeParams = getCircleFromPoints(pts); break;
            case 'rectangle': shapeParams = getRectFromPoints(pts); break;
            case 'line': shapeParams = getLineFromPoints(pts); break;
            case 'triangle': shapeParams = { vertices: getTriangleFromPoints(pts) }; break;
            default: break;
          }
          if (shapeParams) {
            finalStroke = {
              id: finalStroke.id,
              shapeType: detected,
              shapeParams,
              color: finalStroke.color,
              size: finalStroke.size,
              tool: finalStroke.tool,
              points: finalStroke.points,
            };

            // Visual feedback
            const bb = flatToPoints(currentStroke.points);
            const cx = bb.reduce((s, p) => s + p.x, 0) / bb.length;
            const cy = bb.reduce((s, p) => s + p.y, 0) / bb.length;
            setShapeSnapFeedback({ x: cx, y: cy, shape: detected });
            setTimeout(() => setShapeSnapFeedback(null), 800);

            sendData(drawShape(finalStroke.id, detected, shapeParams, finalStroke.color, finalStroke.size));
            sendData(drawEnd());
            setStrokes((prev) => [...prev, finalStroke]);
            setCurrentStroke(null);

            if (triggerDebouncedSave && roomId) {
              triggerDebouncedSave(roomId, () => {
                const stage = stageRef?.current;
                return stage ? stage.toDataURL({ pixelRatio: 2 }) : null;
              });
            }
            return;
          }
        }
      }

      // No shape detected — send as freehand stroke
      setStrokes((prev) => [...prev, finalStroke]);
      sendData(drawStroke(finalStroke.id, finalStroke.points, finalStroke.color, finalStroke.size, finalStroke.tool));
      sendData(drawEnd());

      if (triggerDebouncedSave && roomId) {
        triggerDebouncedSave(roomId, () => {
          const stage = stageRef?.current;
          return stage ? stage.toDataURL({ pixelRatio: 2 }) : null;
        });
      }
    }
    setCurrentStroke(null);
  }, [currentStroke, sendData, triggerDebouncedSave, roomId, stageRef, smartShapes, tool]);

  // ═══ SHAPE DRAG-TO-DRAW (rect / circle) ═══

  const startShapeDraw = useCallback((e) => {
    const stage = stageRef?.current;
    if (!stage) return;

    const pos = getRelativePointerPosition();
    shapeStart.current = { x: pos.x, y: pos.y };
    isDrawingShape.current = true;

    undoStack.current.push({ strokes: [...strokes], shapes: [...shapes] });
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
  }, [stageRef, getRelativePointerPosition, strokes, shapes]);

  const continueShapeDraw = useCallback(() => {
    if (!isDrawingShape.current || !shapeStart.current) return;
    // Preview is handled in WhiteboardCanvas via shapePreview state
    const pos = getRelativePointerPosition();
    const start = shapeStart.current;
    const shift = shiftHeldRef.current;

    if (tool === 'rect') {
      let x = Math.min(start.x, pos.x);
      let y = Math.min(start.y, pos.y);
      let w = Math.abs(pos.x - start.x);
      let h = Math.abs(pos.y - start.y);
      if (shift) { const side = Math.min(w, h); w = side; h = side; }
      setShapePreviewData({ type: 'rect', x, y, width: w, height: h });
    } else if (tool === 'circle') {
      let rx = Math.abs(pos.x - start.x) / 2;
      let ry = Math.abs(pos.y - start.y) / 2;
      if (shift) { const r = Math.min(rx, ry); rx = r; ry = r; }
      const cx = (start.x + pos.x) / 2;
      const cy = (start.y + pos.y) / 2;
      setShapePreviewData({ type: 'circle', centerX: cx, centerY: cy, radiusX: rx, radiusY: ry });
    }
  }, [getRelativePointerPosition, tool]);

  const stopShapeDraw = useCallback(() => {
    if (!isDrawingShape.current || !shapeStart.current) {
      isDrawingShape.current = false;
      return;
    }

    const pos = getRelativePointerPosition();
    const start = shapeStart.current;
    const shift = shiftHeldRef.current;
    const id = generateShapeId();

    if (tool === 'rect') {
      let x = Math.min(start.x, pos.x);
      let y = Math.min(start.y, pos.y);
      let w = Math.abs(pos.x - start.x);
      let h = Math.abs(pos.y - start.y);
      if (shift) { const side = Math.min(w, h); w = side; h = side; }

      if (w > 2 && h > 2) {
        const shape = { id, shapeType: 'rect', x, y, width: w, height: h, color, size: brushSize };
        setShapes((prev) => [...prev, shape]);
        sendData(drawShape(id, 'rect', { x, y, width: w, height: h }, color, brushSize));
      }
    } else if (tool === 'circle') {
      let rx = Math.abs(pos.x - start.x) / 2;
      let ry = Math.abs(pos.y - start.y) / 2;
      if (shift) { const r = Math.min(rx, ry); rx = r; ry = r; }
      const cx = (start.x + pos.x) / 2;
      const cy = (start.y + pos.y) / 2;

      if (rx > 2 && ry > 2) {
        const shape = { id, shapeType: 'circle', centerX: cx, centerY: cy, radiusX: rx, radiusY: ry, color, size: brushSize };
        setShapes((prev) => [...prev, shape]);
        sendData(drawShape(id, 'circle', { centerX: cx, centerY: cy, radiusX: rx, radiusY: ry }, color, brushSize));
      }
    }

    isDrawingShape.current = false;
    shapeStart.current = null;
    setShapePreviewData(null);

    if (triggerDebouncedSave && roomId) {
      triggerDebouncedSave(roomId, () => {
        const stage = stageRef?.current;
        return stage ? stage.toDataURL({ pixelRatio: 2 }) : null;
      });
    }
  }, [getRelativePointerPosition, tool, color, brushSize, sendData, triggerDebouncedSave, roomId, stageRef]);

  // Shape preview state (for WhiteboardCanvas to render)
  const [shapePreviewData, setShapePreviewData] = useState(null);

  const clearCanvas = useCallback(() => {
    undoStack.current.push({ strokes: [...strokes], shapes: [...shapes] });
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    setStrokes([]);
    setRemoteStrokes([]);
    setShapes([]);
    setRemoteShapes([]);
    sendData(clearMsg());
  }, [strokes, shapes, sendData]);

  const undoLast = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop();
    if (prev.strokes !== undefined) setStrokes(prev.strokes);
    if (prev.shapes !== undefined) setShapes(prev.shapes);
    sendData(undoMsg());
  }, [sendData]);

  // ═══ ZOOM & PAN ═══

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef?.current;
    if (!stage) return;
    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mouseTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.1, Math.min(5, dir > 0 ? oldScale * scaleBy : oldScale / scaleBy));
    setStageScale(newScale);
    setStagePos({ x: pointer.x - mouseTo.x * newScale, y: pointer.y - mouseTo.y * newScale });
  }, [stageRef]);

  const handlePinchZoom = useCallback((e) => {
    const stage = stageRef?.current;
    if (!stage) return;
    const t1 = e.evt.touches[0], t2 = e.evt.touches[1];
    if (!t1 || !t2) return;
    const dist = Math.sqrt((t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2);
    if (!stage._lastPinchDist) { stage._lastPinchDist = dist; return; }
    const scale = Math.max(0.1, Math.min(5, stage.scaleX() * (dist / stage._lastPinchDist)));
    const center = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    setStageScale(scale);
    setStagePos({
      x: center.x - (center.x - stage.x()) * (scale / stage.scaleX()),
      y: center.y - (center.y - stage.y()) * (scale / stage.scaleY()),
    });
    stage._lastPinchDist = dist;
  }, [stageRef]);

  const handlePinchEnd = useCallback(() => {
    const stage = stageRef?.current;
    if (stage) stage._lastPinchDist = null;
  }, [stageRef]);

  const zoomIn = useCallback(() => setStageScale((s) => Math.min(5, s * 1.2)), []);
  const zoomOut = useCallback(() => setStageScale((s) => Math.max(0.1, s / 1.2)), []);
  const resetZoom = useCallback(() => { setStageScale(1); setStagePos({ x: 0, y: 0 }); }, []);

  // Spacebar pan
  useEffect(() => {
    const down = (e) => { if (e.code === 'Space' && !e.repeat && e.target.tagName !== 'INPUT') { e.preventDefault(); setIsPanning(true); } };
    const up = (e) => { if (e.code === 'Space') { setIsPanning(false); panStart.current = null; } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Middle mouse pan
  const handleMiddleMousePan = useCallback((e) => {
    if (e.evt.buttons === 4 || isPanning) {
      const stage = stageRef?.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!panStart.current) { panStart.current = { x: pointer.x - stagePos.x, y: pointer.y - stagePos.y }; return; }
      setStagePos({ x: pointer.x - panStart.current.x, y: pointer.y - panStart.current.y });
    }
  }, [stageRef, stagePos, isPanning]);

  const handlePanEnd = useCallback(() => { panStart.current = null; }, []);

  // ═══ VIEWPORT CULLING ═══

  const getViewport = useCallback(() => ({ x: stagePos.x, y: stagePos.y, scale: stageScale }), [stagePos, stageScale]);

  const getVisibleLocal = useCallback((canvasW, canvasH) => {
    return getVisibleShapes(strokes, getViewport(), canvasW, canvasH);
  }, [strokes, getViewport]);

  const getVisibleRemote = useCallback((canvasW, canvasH) => {
    return getVisibleShapes(remoteStrokes, getViewport(), canvasW, canvasH);
  }, [remoteStrokes, getViewport]);

  // Export
  const exportDataURL = useCallback(() => {
    const stage = stageRef?.current;
    return stage ? stage.toDataURL({ pixelRatio: 2 }) : null;
  }, [stageRef]);

  // ═══ REMOTE DATA HANDLER ═══

  useEffect(() => {
    if (!onData) return;
    const unsub = onData((data) => {
      switch (data.type) {
        case MSG.DRAW_STROKE:
          setRemoteStrokes((prev) => [...prev, { id: data.id, points: data.points, color: data.color, size: data.size, tool: data.tool }]);
          break;
        case MSG.DRAW_SHAPE: {
          // Handle both smart-shape params and drag-to-draw params
          const shapeData = { id: data.id, shapeType: data.shapeType, color: data.color, size: data.size };
          if (data.shapeType === 'rect') {
            const p = data.shapeParams || data;
            shapeData.x = p.x;
            shapeData.y = p.y;
            shapeData.width = p.width;
            shapeData.height = p.height;
            // If it has shapeParams, it's a smart shape → goes to remoteStrokes with full shapeParams
            if (data.shapeParams) {
              shapeData.shapeParams = data.shapeParams;
              shapeData.points = [];
              setRemoteStrokes((prev) => [...prev, shapeData]);
            } else {
              setRemoteShapes((prev) => [...prev, shapeData]);
            }
          } else if (data.shapeType === 'circle') {
            const p = data.shapeParams || data;
            if (p.centerX !== undefined) {
              shapeData.centerX = p.centerX;
              shapeData.centerY = p.centerY;
              shapeData.radiusX = p.radiusX;
              shapeData.radiusY = p.radiusY;
              setRemoteShapes((prev) => [...prev, shapeData]);
            } else {
              // Smart shape circle (cx, cy, radius)
              shapeData.shapeParams = data.shapeParams;
              shapeData.points = [];
              setRemoteStrokes((prev) => [...prev, shapeData]);
            }
          } else {
            // line, triangle, etc. — smart shapes
            shapeData.shapeParams = data.shapeParams;
            shapeData.points = [];
            setRemoteStrokes((prev) => [...prev, shapeData]);
          }
          break;
        }
        case MSG.DRAW_START:
          setRemoteCurrentStroke({ id: data.id || generateStrokeId(), points: [data.x, data.y], color: data.color, size: data.size, tool: data.tool });
          break;
        case MSG.DRAW_MOVE:
          setRemoteCurrentStroke((prev) => prev ? { ...prev, points: [...prev.points, data.x, data.y] } : null);
          break;
        case MSG.DRAW_END:
          setRemoteCurrentStroke(null);
          break;
        case MSG.HANDWRITING_STROKE:
          setRemoteStrokes((prev) => [...prev, { id: data.id, points: data.points, color: data.color, size: data.size, tool: 'pen' }]);
          break;
        case MSG.CLEAR:
          undoStack.current.push({ strokes: [...strokes], shapes: [...shapes] });
          setStrokes([]);
          setRemoteStrokes([]);
          setShapes([]);
          setRemoteShapes([]);
          break;
        case MSG.UNDO:
          setRemoteStrokes((prev) => prev.slice(0, -1));
          setRemoteShapes((prev) => prev.slice(0, -1));
          break;
        case MSG.CURSOR_MOVE:
          setRemoteCursor({ x: data.x, y: data.y, peerId: data.peerId });
          clearTimeout(cursorTimer.current);
          cursorTimer.current = setTimeout(() => setRemoteCursor(null), 3000);
          break;
        case MSG.SYNC_REQUEST:
          if (sendData) sendData({ type: MSG.SYNC_RESPONSE, strokes: [...strokes, ...remoteStrokes] });
          break;
        case MSG.SYNC_RESPONSE:
          if (data.strokes && Array.isArray(data.strokes)) setRemoteStrokes(data.strokes);
          break;
        default: break;
      }
    });
    return unsub;
  }, [onData, strokes, remoteStrokes, shapes, sendData]);

  // Cleanup
  useEffect(() => {
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); clearTimeout(cursorTimer.current); };
  }, []);

  return {
    startDrawing, draw: continueDrawing, stopDrawing, clearCanvas, undoLast,
    strokes, remoteStrokes, currentStroke, remoteCurrentStroke, setStrokes,
    shapes, remoteShapes, setShapes,
    shapePreviewData,
    tool, setTool, color, setColor, brushSize, setBrushSize,
    smartShapes, setSmartShapes, shapeSnapFeedback,
    remoteCursor,
    stageScale, stagePos, setStagePos,
    handleWheel, handlePinchZoom, handlePinchEnd,
    handleMiddleMousePan, handlePanEnd, isPanning,
    zoomIn, zoomOut, resetZoom,
    exportDataURL, getViewport, getVisibleLocal, getVisibleRemote,
  };
}
