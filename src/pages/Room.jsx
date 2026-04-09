/**
 * Room.jsx — Whiteboard Room Page (Full Integration)
 *
 * Orchestrates all systems:
 *   - PeerJS with primary/fallback signaling
 *   - Supabase room persistence with auto-save
 *   - PIN protection via PINGate wrapper
 *   - Konva canvas with pinch-to-zoom + spacebar pan
 *   - Voice notes with speech-to-handwriting
 *   - Drag-to-draw shape tools (rect, circle)
 *   - Minimap + Performance overlay
 *   - Smart shape recognition feedback
 *   - Mobile-optimized toolbar
 *   - Unique IDs for all elements
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import usePeer from '../hooks/usePeer';
import useRoom from '../hooks/useRoom';
import useCanvas from '../hooks/useCanvas';
import useRoomPersistence from '../hooks/useRoomPersistence';
import useVoiceNote from '../hooks/useVoiceNote';
import WhiteboardCanvas from '../components/WhiteboardCanvas';
import Toolbar from '../components/Toolbar';
import ConnectionStatus from '../components/ConnectionStatus';
import RoomBadge from '../components/RoomBadge';
import PINGate from '../components/PINGate';
import ToastContainer from '../components/Toast';
import VoiceNotePin from '../components/VoiceNotePin';
import Minimap from '../components/Minimap';
import PerfOverlay from '../components/PerfOverlay';
import { MSG, helloMsg, roomPinChanged, voiceNoteMsg } from '../lib/protocol';
import { track } from '../lib/analytics';
import { generateVoiceNoteId } from '../lib/idGenerator';

const REMOTE_COLORS = ['#60A5FA','#34D399','#F472B6','#FBBF24','#A78BFA','#FB923C','#2DD4BF','#F87171'];
const NAMES = ['Alex','Jordan','Sam','Taylor','Morgan','Casey','Riley','Drew'];

function formatTimeAgo(date) {
  if (!date) return null;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function getPinFromHash() {
  const match = window.location.hash.match(/pin=(\d{4,6})/);
  return match ? match[1] : null;
}

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get('host') === 'true';
  const stageRef = useRef(null);

  // ── Viewport dimensions ────────────────────────────────────
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const resize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ── Local identity ─────────────────────────────────────────
  const [myName] = useState(() => NAMES[Math.floor(Math.random() * NAMES.length)]);
  const [myColor] = useState(() => REMOTE_COLORS[Math.floor(Math.random() * REMOTE_COLORS.length)]);

  // ── Remote peer info ───────────────────────────────────────
  const [remoteName, setRemoteName] = useState('');
  const [remoteColor, setRemoteColor] = useState(REMOTE_COLORS[0]);

  // ── UI state ───────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lastSavedDisplay, setLastSavedDisplay] = useState(null);
  const [backgroundDataURL, setBackgroundDataURL] = useState(null);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showPerfOverlay, setShowPerfOverlay] = useState(false);

  // ── Voice notes state ──────────────────────────────────────
  const [voiceNotes, setVoiceNotes] = useState([]);
  const [voiceRecordPos, setVoiceRecordPos] = useState(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [activeVoiceNoteId, setActiveVoiceNoteId] = useState(null);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
  }, []);
  const removeToast = useCallback((id) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);

  // ── PeerJS ─────────────────────────────────────────────────
  const { peer, myPeerId, isReady, error: peerError, serverStatus } = usePeer(isHost ? roomId : null);

  // ── Room connection ────────────────────────────────────────
  const { isConnected, remotePeerId, sendData, onData, connectionState } = useRoom({
    peer, roomId, isHost, isReady,
  });

  // ── Supabase persistence ───────────────────────────────────
  const {
    loadRoom, saveRoom, triggerDebouncedSave,
    isSaving, lastSaved, isLoading: persistenceLoading, snapshots,
  } = useRoomPersistence(roomId);

  // ── Canvas engine ──────────────────────────────────────────
  const {
    startDrawing, draw, stopDrawing, clearCanvas, undoLast,
    strokes, remoteStrokes, currentStroke, remoteCurrentStroke, setStrokes,
    shapes, remoteShapes, setShapes, shapePreviewData,
    tool, setTool, color, setColor, brushSize, setBrushSize,
    smartShapes, setSmartShapes, shapeSnapFeedback,
    remoteCursor,
    stageScale, stagePos, setStagePos,
    handleWheel, handlePinchZoom, handlePinchEnd,
    handleMiddleMousePan, handlePanEnd, isPanning,
    zoomIn, zoomOut, resetZoom,
    exportDataURL, getViewport, getVisibleLocal, getVisibleRemote,
  } = useCanvas({ stageRef, sendData, onData, myPeerId, roomId, triggerDebouncedSave });

  // ── Voice recording hook (with handwriting) ────────────────
  // CRITICAL: pass a getter function, NOT a static ref — the Stage
  // hasn't mounted when useVoiceNote initializes, so stageRef.current
  // would be null and handwriting would silently fail.
  const voiceHook = useVoiceNote({
    onTranscriptReady: (text) => {
      if (text) addToast('Handwriting started!', 'info');
    },
    canvasStartX: voiceRecordPos?.x || 100,
    canvasStartY: voiceRecordPos?.y || 100,
    getKonvaLayer: () => {
      // Layer index 2 = local strokes layer (see WhiteboardCanvas.jsx layer order)
      const stage = stageRef.current;
      if (!stage) return null;
      const layers = stage.getLayers();
      return layers && layers.length > 2 ? layers[2] : (layers?.[0] || null);
    },
    brushSize: 4,
    color,
    canvasWidth: dimensions.width,
    sendData,
    onStrokeAdded: (stroke) => {
      setStrokes((prev) => [...prev, stroke]);
    },
  });

  const { isRecording, liveTranscript, finalTranscript, isWriting, audioLevel, permissionDenied } = voiceHook;

  // ── Load saved canvas on mount ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { canvasData } = await loadRoom(roomId);
      if (!cancelled && canvasData) {
        setBackgroundDataURL(canvasData);
        addToast('Canvas restored from save', 'success');
      }
    }
    load();
    track('user_joined', { roomId, isHost });
    return () => { cancelled = true; };
  }, [roomId, loadRoom, addToast, isHost]);

  // ── Update lastSaved display every 30s ─────────────────────
  useEffect(() => {
    if (!lastSaved) return;
    const update = () => setLastSavedDisplay(formatTimeAgo(lastSaved));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  // ── Recording timer ────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) { setRecordingElapsed(0); return; }
    const interval = setInterval(() => setRecordingElapsed((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // ── HELLO handshake on connect ─────────────────────────────
  useEffect(() => {
    if (isConnected) {
      sendData(helloMsg(myName, myColor));
      addToast('Peer connected!', 'success');
    }
  }, [isConnected, sendData, myName, myColor, addToast]);

  // ── Listen for remote messages ─────────────────────────────
  useEffect(() => {
    if (!onData) return;
    return onData((data) => {
      if (data.type === MSG.HELLO) {
        setRemoteName(data.name);
        setRemoteColor(data.color);
        addToast(`${data.name} joined the room`, 'success');
      }
      if (data.type === MSG.ROOM_PIN_CHANGED) {
        if (data.newPinHash) {
          window.location.hash = `pin=${data.newPinHash}`;
          addToast('Room PIN was changed by host', 'info');
        }
      }
      if (data.type === MSG.VOICE_NOTE) {
        const note = {
          id: data.id,
          x: data.x, y: data.y,
          audioUrl: data.audioBase64,
          transcript: data.transcript || '',
          peerId: data.peerId,
          color: remoteColor,
          timestamp: Date.now(),
        };
        setVoiceNotes((prev) => [...prev, note]);
        addToast('Voice note received', 'info');
      }
    });
  }, [onData, addToast, remoteColor]);

  // ── Disconnect toast ───────────────────────────────────────
  const prevConnState = useRef(connectionState);
  useEffect(() => {
    if (prevConnState.current === 'connected' && connectionState === 'disconnected' && remoteName) {
      addToast(`${remoteName} left the room`, 'error');
    }
    prevConnState.current = connectionState;
  }, [connectionState, remoteName, addToast]);

  // ── Voice recording handlers ───────────────────────────────
  const handleVoiceStop = useCallback(async () => {
    const result = await voiceHook.stopRecording();
    if (result && result.audioBlob && voiceRecordPos) {
      const audioUrl = URL.createObjectURL(result.audioBlob);
      const id = activeVoiceNoteId || generateVoiceNoteId();
      const note = {
        id, x: voiceRecordPos.x, y: voiceRecordPos.y,
        audioUrl, transcript: result.transcript || '',
        peerId: myPeerId, color: myColor, timestamp: Date.now(),
      };
      setVoiceNotes((prev) => prev.map(n => n.id === id ? { ...n, ...note } : n));

      // Send over WebRTC as base64 data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        sendData(voiceNoteMsg(id, note.x, note.y, note.transcript, myPeerId, reader.result));
      };
      reader.readAsDataURL(result.audioBlob);
      addToast('Voice note placed!', 'success');
      track('voice_note_added', { roomId });
    }
    setVoiceRecordPos(null);
    setActiveVoiceNoteId(null);
  }, [voiceHook, voiceRecordPos, myPeerId, myColor, sendData, addToast, roomId, activeVoiceNoteId]);

  const handleVoiceClick = useCallback(async (e) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const worldPos = stage.getAbsoluteTransform().copy().invert().point(pos);

    if (isRecording) {
      await handleVoiceStop();
    } else {
      // Pass worldPos directly to startRecording so the frozen position
      // is captured synchronously from the click — no React state timing issues.
      const ok = await voiceHook.startRecording(worldPos);
      if (ok) {
        const vnId = generateVoiceNoteId();
        setVoiceRecordPos(worldPos);
        setActiveVoiceNoteId(vnId);
        // Add a placeholder note that shows recording state
        setVoiceNotes((prev) => [...prev, {
          id: vnId,
          x: worldPos.x,
          y: worldPos.y,
          audioUrl: null,
          transcript: '',
          peerId: myPeerId,
          color: myColor,
          timestamp: Date.now(),
          isRecordingPlaceholder: true,
        }]);
        addToast('Recording… click canvas again to stop', 'info');
      } else {
        addToast('Microphone permission denied', 'error');
      }
    }
  }, [isRecording, voiceHook, handleVoiceStop, addToast, myPeerId, myColor]);

  // ── Canvas mouse down wrapper (intercepts voice tool) ──────
  const handleMouseDown = useCallback((e) => {
    if (tool === 'voice') {
      handleVoiceClick(e);
      return;
    }
    startDrawing(e);
  }, [tool, startDrawing, handleVoiceClick]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'p') setTool('pen');
      else if (k === 'e') setTool('eraser');
      else if (k === 'l') setTool('line');
      else if (k === 'r') setTool('rect');
      else if (k === 'c') setTool('circle');
      else if (k === 'v') setTool('voice');
      else if (k === 'u') undoLast();
      else if (k === 's' && !e.ctrlKey) { e.preventDefault(); setSmartShapes((p) => !p); }
      else if (k === 'm') setShowMinimap((p) => !p);
      else if (e.ctrlKey && e.shiftKey && k === 'delete') { e.preventDefault(); clearCanvas(); }
      else if (e.ctrlKey && e.shiftKey && k === 'p') { e.preventDefault(); setShowPerfOverlay((p) => !p); }
      else if (k === '=' || k === '+') { e.preventDefault(); zoomIn(); }
      else if (k === '-') { e.preventDefault(); zoomOut(); }
      else if (k === '0' && e.ctrlKey) { e.preventDefault(); resetZoom(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setTool, undoLast, clearCanvas, zoomIn, zoomOut, resetZoom, setSmartShapes]);

  // ── Copy room link ─────────────────────────────────────────
  const copyLink = useCallback(async () => {
    const hash = window.location.hash || '';
    const url = `${window.location.origin}/room/${roomId}${hash}`;
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: 'Live Whiteboard', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  }, [roomId]);

  const regeneratePin = useCallback(() => {
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    window.location.hash = `pin=${newPin}`;
    sendData(roomPinChanged(newPin));
    addToast(`PIN changed to ${newPin}`, 'info');
  }, [sendData, addToast]);

  const exportPNG = useCallback(() => {
    const dataURL = exportDataURL();
    if (!dataURL) return;
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `whiteboard-${roomId}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('PNG exported!', 'info');
    track('export_png', { roomId });
  }, [roomId, exportDataURL, addToast]);

  const handleManualSave = useCallback(async () => {
    const dataURL = exportDataURL();
    if (dataURL) {
      await saveRoom(roomId, dataURL);
      addToast('Canvas saved!', 'success');
    }
  }, [exportDataURL, saveRoom, roomId, addToast]);

  const deleteVoiceNote = useCallback((id) => {
    setVoiceNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // ── Compute visible counts for perf overlay ────────────────
  const visLocalCount = getVisibleLocal ? getVisibleLocal(dimensions.width, dimensions.height).length : (strokes?.length || 0);
  const visRemoteCount = getVisibleRemote ? getVisibleRemote(dimensions.width, dimensions.height).length : (remoteStrokes?.length || 0);
  const totalShapes = (strokes?.length || 0) + (remoteStrokes?.length || 0) + (shapes?.length || 0) + (remoteShapes?.length || 0);
  const visibleShapes = visLocalCount + visRemoteCount + (shapes?.length || 0) + (remoteShapes?.length || 0);

  const formatRecTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <PINGate roomId={roomId}>
      <div className="h-screen w-screen overflow-hidden bg-brand-black relative">

        {/* ═══ Loading Spinner ═══ */}
        {persistenceLoading && (
          <div className="fixed inset-0 z-[70] bg-brand-black/80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 animate-fade-in">
              <div className="w-12 h-12 border-3 border-brand-grey-lt border-t-brand-yellow rounded-full animate-spin" />
              <p className="text-brand-grey-txt text-sm">Loading canvas…</p>
            </div>
          </div>
        )}

        {/* ═══ Top Bar ═══ */}
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 bg-brand-dark/90 backdrop-blur-md border-b border-brand-grey-lt">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-brand-yellow font-bold text-sm shrink-0">⚡</span>
            <code className="text-brand-white text-xs font-mono bg-brand-grey px-2 py-1 rounded truncate max-w-[120px] sm:max-w-none">{roomId}</code>
            <button
              onClick={copyLink}
              aria-label="Copy room link"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-grey-mid text-brand-grey-txt hover:text-brand-yellow hover:bg-brand-grey transition-colors text-xs shrink-0">
              {copied ? (
                <><svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg><span className="text-emerald-400 hidden sm:inline">Copied!</span></>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg><span className="hidden sm:inline">Copy</span></>
              )}
            </button>
            <RoomBadge />
            {isHost && getPinFromHash() && (
              <button
                onClick={regeneratePin}
                title="Regenerate PIN"
                aria-label="Regenerate room PIN"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-grey text-brand-grey-txt hover:text-brand-yellow text-xs transition-colors shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                <span className="hidden sm:inline">New PIN</span>
              </button>
            )}
          </div>

          {/* Center — Save status */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            {isSaving && (
              <span className="flex items-center gap-1 text-brand-yellow animate-pulse">
                <div className="w-2 h-2 rounded-full bg-brand-yellow animate-ping" /> Saving…
              </span>
            )}
            {!isSaving && lastSavedDisplay && (
              <span className="text-brand-grey-txt">Saved {lastSavedDisplay}</span>
            )}
            <button
              onClick={handleManualSave}
              title="Save now"
              aria-label="Save canvas"
              className="px-2 py-1 rounded-lg text-brand-grey-txt hover:text-brand-yellow hover:bg-brand-grey transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
              </svg>
            </button>
            {snapshots.length > 0 && (
              <button
                onClick={() => setShowHistory(true)}
                title="Room history"
                aria-label="View room history"
                className="px-2 py-1 rounded-lg text-brand-grey-txt hover:text-brand-yellow hover:bg-brand-grey transition-colors text-xs">
                History
              </button>
            )}
          </div>

          <ConnectionStatus connectionState={connectionState} serverStatus={serverStatus} />
        </div>

        {/* ═══ Toolbar ═══ */}
        <Toolbar
          tool={tool} setTool={setTool}
          color={color} setColor={setColor}
          brushSize={brushSize} setBrushSize={setBrushSize}
          onUndo={undoLast} onClear={clearCanvas} onExport={exportPNG}
          zoomIn={zoomIn} zoomOut={zoomOut} resetZoom={resetZoom}
          stageScale={stageScale}
          smartShapes={smartShapes} setSmartShapes={setSmartShapes}
        />

        {/* ═══ Konva Canvas ═══ */}
        <WhiteboardCanvas
          stageRef={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          strokes={strokes}
          remoteStrokes={remoteStrokes}
          currentStroke={currentStroke}
          remoteCurrentStroke={remoteCurrentStroke}
          shapes={shapes}
          remoteShapes={remoteShapes}
          shapePreviewData={shapePreviewData}
          currentColor={color}
          stageScale={stageScale}
          stagePos={stagePos}
          setStagePos={setStagePos}
          onMouseDown={handleMouseDown}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onWheel={handleWheel}
          onTouchMove={handlePinchZoom}
          onTouchEnd={handlePinchEnd}
          onMiddleMousePan={handleMiddleMousePan}
          onPanEnd={handlePanEnd}
          isPanning={isPanning}
          backgroundDataURL={backgroundDataURL}
          shapeSnapFeedback={shapeSnapFeedback}
          getVisibleLocal={getVisibleLocal}
          getVisibleRemote={getVisibleRemote}
          roomId={roomId}
        />

        {/* ═══ Remote Cursor Overlay ═══ */}
        {remoteCursor && (
          <div className="pointer-events-none absolute z-20 transition-all duration-75 ease-out"
            style={{ left: remoteCursor.x * stageScale + stagePos.x - 8, top: remoteCursor.y * stageScale + stagePos.y - 8 }}>
            <div className="w-4 h-4 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: remoteColor }}/>
            {remoteName && (
              <div className="absolute left-5 -top-1 whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium text-white shadow-md"
                style={{ backgroundColor: remoteColor }}>
                {remoteName}
              </div>
            )}
          </div>
        )}

        {/* ═══ Voice Note Pins ═══ */}
        {voiceNotes.map((note) => {
          const isThisRecording = isRecording && note.id === activeVoiceNoteId;
          const isThisWriting = isWriting && note.id === activeVoiceNoteId;
          return (
            <VoiceNotePin
              key={note.id}
              note={note}
              stageScale={stageScale}
              stagePos={stagePos}
              userColor={note.color || myColor}
              isOwn={note.peerId === myPeerId}
              onDelete={deleteVoiceNote}
              isRecording={isThisRecording}
              liveTranscript={isThisRecording ? liveTranscript : ''}
              isWriting={isThisWriting}
              audioLevel={isThisRecording ? audioLevel : 0}
            />
          );
        })}

        {/* ═══ Voice Recording Indicator (glowing ring at placement pos) ═══ */}
        {isRecording && voiceRecordPos && (
          <div
            className="absolute z-25 pointer-events-none"
            style={{
              left: voiceRecordPos.x * stageScale + stagePos.x - 30,
              top: voiceRecordPos.y * stageScale + stagePos.y - 30,
            }}
          >
            {/* Glowing ring indicating where text will appear */}
            <div className="w-[60px] h-[60px] rounded-full border-2 border-brand-yellow/50 animate-pulse">
              <div className="absolute inset-2 rounded-full border border-brand-yellow/30 animate-ping" />
            </div>
          </div>
        )}

        {/* ═══ Writing indicator (pen is drawing) ═══ */}
        {isWriting && voiceRecordPos && (
          <div
            className="absolute z-25 pointer-events-none animate-fade-in"
            style={{
              left: voiceRecordPos.x * stageScale + stagePos.x - 40,
              top: voiceRecordPos.y * stageScale + stagePos.y - 30,
            }}
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/80 backdrop-blur-sm border border-blue-400/30 shadow-lg">
              <svg className="w-3.5 h-3.5 text-white animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ animationDuration: '0.5s' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="text-white text-[11px] font-medium">Writing…</span>
            </div>
          </div>
        )}

        {/* ═══ Minimap ═══ */}
        {showMinimap && (
          <Minimap
            strokes={strokes}
            remoteStrokes={remoteStrokes}
            viewport={getViewport ? getViewport() : { x: stagePos.x, y: stagePos.y, scale: stageScale }}
            canvasW={dimensions.width}
            canvasH={dimensions.height}
            onTeleport={setStagePos}
          />
        )}

        {/* ═══ Performance Overlay ═══ */}
        {showPerfOverlay && (
          <PerfOverlay totalShapes={totalShapes} visibleShapes={visibleShapes} />
        )}

        {/* ═══ Mobile Save Indicator ═══ */}
        <div className="md:hidden fixed top-14 left-1/2 -translate-x-1/2 z-20">
          {isSaving && (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-brand-dark/90 border border-brand-grey-lt text-brand-yellow text-xs animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-yellow" /> Saving…
            </span>
          )}
        </div>

        {/* ═══ Toasts ═══ */}
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        {/* ═══ Room History Modal ═══ */}
        {showHistory && (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
            <div className="bg-brand-dark border border-brand-grey-lt rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-brand-white font-bold text-lg">Room History</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  aria-label="Close history"
                  className="text-brand-grey-txt hover:text-brand-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              {snapshots.length === 0 ? (
                <p className="text-brand-grey-txt text-sm text-center py-8">No snapshots saved yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {snapshots.slice().reverse().map((snap, i) => (
                    <div key={`snap-${snap.timestamp}-${i}`} className="bg-brand-grey rounded-xl border border-brand-grey-lt overflow-hidden">
                      <div className="aspect-video bg-brand-black/50 flex items-center justify-center">
                        <img src={snap.data} alt={`Snapshot ${i + 1}`} className="w-full h-full object-contain" />
                      </div>
                      <div className="p-3 flex items-center justify-between">
                        <span className="text-brand-grey-txt text-xs">{new Date(snap.timestamp).toLocaleString()}</span>
                        <button
                          onClick={() => { setBackgroundDataURL(snap.data); setShowHistory(false); addToast('Snapshot restored', 'success'); }}
                          className="px-3 py-1 rounded-lg bg-brand-yellow/10 text-brand-yellow text-xs hover:bg-brand-yellow/20 transition-colors">
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Error Overlay ═══ */}
        {peerError && peerError.type !== 'peer-unavailable' && peerError.type !== 'unavailable-id' && (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center">
            <div className="bg-brand-dark border border-red-500/50 rounded-2xl p-8 max-w-sm text-center">
              <h2 className="text-red-400 font-bold text-lg mb-2">Connection Error</h2>
              <p className="text-brand-grey-txt text-sm mb-4">{peerError.message || 'Could not connect.'}</p>
              <button onClick={() => window.location.reload()}
                className="px-6 py-2 rounded-xl bg-brand-yellow text-brand-black font-semibold hover:bg-brand-yellow-lt transition-colors">
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </PINGate>
  );
}
