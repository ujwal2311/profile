/**
 * useVoiceNote.js — Voice Recording + Speech-to-Handwriting Hook
 *
 * Uses Web SpeechRecognition for real-time transcription.
 * On stop, triggers handwriting animation on the Konva canvas.
 * Provides audio level, live/final transcripts, and writing state.
 *
 * KEY FIX: accepts getKonvaLayer (a function) instead of a static konvaLayer
 * reference, because the Konva Stage hasn't mounted when the hook initializes.
 *
 * CURSOR TRACKING: Maintains a persistent write cursor so that successive
 * voice dictations append below previous text instead of overwriting.
 * The start position is frozen at recording-start so it survives React
 * state changes (voiceRecordPos being set to null on stop).
 */

import { useRef, useState, useCallback } from 'react';
import { getTextStrokes, animateHandwriting } from '../lib/handwritingRenderer';
import { handwritingStrokeMsg } from '../lib/protocol';
import { generateVoiceNoteId } from '../lib/idGenerator';

/**
 * @param {Object} opts
 * @param {Function} opts.onTranscriptReady - Called with final transcript
 * @param {number} opts.canvasStartX - X position to start writing
 * @param {number} opts.canvasStartY - Y position to start writing
 * @param {Function} opts.getKonvaLayer - Function returning a Konva.Layer (lazy evaluation)
 * @param {number} [opts.brushSize=4]
 * @param {string} opts.color
 * @param {number} opts.canvasWidth
 * @param {Function} opts.sendData - WebRTC send
 * @param {Function} opts.onStrokeAdded - For undo stack
 */
export default function useVoiceNote({
  onTranscriptReady,
  canvasStartX = 100,
  canvasStartY = 100,
  getKonvaLayer,
  brushSize = 4,
  color = '#FACC15',
  canvasWidth = 1920,
  sendData,
  onStrokeAdded,
} = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const startTimeRef = useRef(0);
  const animControllerRef = useRef(null);
  const accumulatedFinalRef = useRef('');
  const lastProcessedResultIdx = useRef(0);

  // Frozen start position — captured at recording start so it survives
  // voiceRecordPos being set to null during cleanup.
  const frozenStartXRef = useRef(100);
  const frozenStartYRef = useRef(100);

  // Persistent write cursor — tracks where the NEXT dictation should begin.
  // After each handwriting animation completes, this advances to the next
  // line so successive dictations never overwrite each other.
  const writeCursorRef = useRef(null);

  // Store latest values in refs so triggerHandwriting always sees current state
  const colorRef = useRef(color);
  const brushSizeRef = useRef(brushSize);
  const canvasStartXRef = useRef(canvasStartX);
  const canvasStartYRef = useRef(canvasStartY);
  const canvasWidthRef = useRef(canvasWidth);
  const sendDataRef = useRef(sendData);
  const onStrokeAddedRef = useRef(onStrokeAdded);
  const getKonvaLayerRef = useRef(getKonvaLayer);

  // Keep refs current
  colorRef.current = color;
  brushSizeRef.current = brushSize;
  canvasStartXRef.current = canvasStartX;
  canvasStartYRef.current = canvasStartY;
  canvasWidthRef.current = canvasWidth;
  sendDataRef.current = sendData;
  onStrokeAddedRef.current = onStrokeAdded;
  getKonvaLayerRef.current = getKonvaLayer;

  /**
   * Start voice recording with speech recognition.
   * @param {{ x: number, y: number }} [startPos] - Canvas world position to write at.
   *   If provided, overrides canvasStartX/Y (avoids React state timing issues).
   */
  const startRecording = useCallback(async (startPos) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermissionDenied(false);

      // ═══ FREEZE the start position NOW ═══
      // If startPos is passed directly from the click handler, use it.
      // Otherwise fall back to canvasStartXRef (which may already be stale).
      if (startPos) {
        frozenStartXRef.current = startPos.x;
        frozenStartYRef.current = startPos.y;
      } else {
        frozenStartXRef.current = canvasStartXRef.current;
        frozenStartYRef.current = canvasStartYRef.current;
      }
      console.log('[useVoiceNote] Frozen start position:', {
        x: frozenStartXRef.current,
        y: frozenStartYRef.current,
      });

      // AnalyserNode for waveform
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      ctxRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
        setAudioLevel(Math.min(100, Math.round(avg * 100 / 128)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // MediaRecorder for audio blob
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(100);
      recorderRef.current = recorder;
      startTimeRef.current = Date.now();

      // Speech Recognition
      accumulatedFinalRef.current = '';
      lastProcessedResultIdx.current = 0;
      setLiveTranscript('');
      setFinalTranscript('');

      try {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          const recog = new SR();
          recog.continuous = true;
          recog.interimResults = true;
          recog.lang = 'en-US';
          recog.maxAlternatives = 1;

          recog.onresult = (ev) => {
            let interim = '';

            // Only process new results that we haven't accumulated yet.
            // This prevents losing earlier final results for long sentences.
            for (let i = lastProcessedResultIdx.current; i < ev.results.length; i++) {
              const result = ev.results[i];
              if (result.isFinal) {
                accumulatedFinalRef.current += result[0].transcript;
                lastProcessedResultIdx.current = i + 1;
              } else {
                interim += result[0].transcript;
              }
            }

            setFinalTranscript(accumulatedFinalRef.current);
            setLiveTranscript(interim);
          };

          recog.onerror = () => { /* graceful degradation */ };
          recog.start();
          recognitionRef.current = recog;
        }
      } catch { /* Speech API unavailable */ }

      setIsRecording(true);
      return true;
    } catch (err) {
      console.error('[useVoiceNote] Permission denied:', err);
      setPermissionDenied(true);
      return false;
    }
  }, []);

  /**
   * Trigger handwriting animation for text.
   * Uses the frozen start position (captured at recording start) so it's
   * not affected by voiceRecordPos being nulled during cleanup.
   * If writeCursorRef exists (from a previous dictation), uses that instead
   * so successive dictations appear on new lines below the previous one.
   */
  const triggerHandwriting = useCallback((text) => {
    if (!text || !text.trim()) {
      console.warn('[useVoiceNote] triggerHandwriting: no text to render');
      return;
    }

    const layerGetter = getKonvaLayerRef.current;
    if (!layerGetter) {
      console.warn('[useVoiceNote] triggerHandwriting: no layer getter');
      return;
    }

    // Priority: writeCursor (from previous dictation) > frozen start position
    const cursor = writeCursorRef.current;
    const sx = cursor ? cursor.x : frozenStartXRef.current;
    const sy = cursor ? cursor.y : frozenStartYRef.current;
    const cw = canvasWidthRef.current;
    const c = colorRef.current;
    const bs = brushSizeRef.current;
    const fontSize = 48;
    const lineHeight = fontSize * 1.3;

    console.log('[useVoiceNote] Generating strokes for:', text.substring(0, 80) + (text.length > 80 ? '...' : ''));
    console.log('[useVoiceNote] Writing at position:', { x: sx, y: sy, source: cursor ? 'writeCursor' : 'frozenStart' });

    const { strokes, endCursorX, endCursorY } = getTextStrokes(text, sx, sy, fontSize, cw);

    if (strokes.length === 0) {
      console.warn('[useVoiceNote] No strokes generated for text');
      return;
    }

    console.log(`[useVoiceNote] ${strokes.length} strokes generated, starting animation`);
    setIsWriting(true);

    // animateHandwriting now accepts a getter function for the layer
    const controller = animateHandwriting(
      layerGetter,  // <-- function, not static ref
      strokes,
      c,
      bs,
      () => {
        // onComplete — advance cursor to next line below rendered text
        console.log('[useVoiceNote] Handwriting animation complete');
        setIsWriting(false);
        animControllerRef.current = null;

        // Advance write cursor to the next line so the next dictation
        // starts below this one. Use frozenStartX for left alignment.
        const nextY = (endCursorY !== undefined ? endCursorY : sy) + lineHeight;
        writeCursorRef.current = {
          x: frozenStartXRef.current,
          y: nextY,
        };
        console.log('[useVoiceNote] Write cursor advanced to:', writeCursorRef.current);
      },
      (konvaLine, id, strokePts) => {
        // onStrokeCreated — sync over WebRTC + push to undo stack
        const flatPoints = [];
        for (const pt of strokePts) {
          flatPoints.push(pt.x, pt.y);
        }
        const sd = sendDataRef.current;
        if (sd) {
          sd(handwritingStrokeMsg(id, flatPoints, c, bs));
        }
        const cb = onStrokeAddedRef.current;
        if (cb) {
          cb({ id, points: flatPoints, color: c, size: bs, tool: 'pen' });
        }
      }
    );

    animControllerRef.current = controller;
  }, []); // intentionally empty — uses refs

  /**
   * Stop recording. Returns audio blob + transcript, triggers handwriting.
   */
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!recorderRef.current || recorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      // Stop recognition
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* already stopped */ }
      }

      recorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const transcript = accumulatedFinalRef.current || '';

        // Cleanup
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (ctxRef.current) { try { ctxRef.current.close(); } catch {} }
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        analyserRef.current = null;
        recognitionRef.current = null;

        setIsRecording(false);
        setAudioLevel(0);

        // Wait 300ms for any final speech recognition results, then trigger handwriting
        setTimeout(() => {
          const finalText = accumulatedFinalRef.current || transcript;
          setFinalTranscript(finalText);
          if (onTranscriptReady) onTranscriptReady(finalText);

          if (finalText.trim()) {
            console.log('[useVoiceNote] Final transcript:', finalText);
            triggerHandwriting(finalText);
          } else {
            console.warn('[useVoiceNote] No transcript to render');
          }
        }, 300);

        resolve({
          audioBlob,
          transcript: accumulatedFinalRef.current || transcript,
          duration: Date.now() - startTimeRef.current,
        });
      };

      recorderRef.current.stop();
    });
  }, [onTranscriptReady, triggerHandwriting]);

  /**
   * Cancel any ongoing handwriting animation.
   */
  const cancelHandwriting = useCallback(() => {
    if (animControllerRef.current) {
      animControllerRef.current.cancel();
      animControllerRef.current = null;
      setIsWriting(false);
    }
  }, []);

  /**
   * Reset the persistent write cursor.
   * Call this only when you want text to start fresh at a new position
   * (e.g., user explicitly clears the canvas).
   */
  const resetWriteCursor = useCallback(() => {
    writeCursorRef.current = null;
  }, []);

  return {
    isRecording,
    liveTranscript,
    finalTranscript,
    isWriting,
    audioLevel,
    permissionDenied,
    startRecording,
    stopRecording,
    cancelHandwriting,
    triggerHandwriting,
    resetWriteCursor,
  };
}
