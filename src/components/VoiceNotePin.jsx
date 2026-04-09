/**
 * VoiceNotePin.jsx — Voice Note Overlay Pin with Transcription States
 *
 * Rendered as positioned HTML div over the canvas.
 * Shows three visual states:
 *   1. Recording: red pulsing mic + live transcript bubble
 *   2. Writing: animated pen icon + "Writing..." text
 *   3. Complete: final transcript + playback controls
 */

import React, { useState, useRef, useCallback } from 'react';

/**
 * @param {Object} props
 * @param {Object} props.note - Voice note data { id, x, y, audioUrl, transcript, color, peerId, timestamp }
 * @param {number} props.stageScale - Current zoom scale
 * @param {Object} props.stagePos - Current pan offset { x, y }
 * @param {string} props.userColor - Fallback color
 * @param {boolean} props.isOwn - Whether this is the local user's note
 * @param {Function} props.onDelete - Delete callback
 * @param {boolean} [props.isRecording] - Whether currently recording
 * @param {string} [props.liveTranscript] - Live interim transcript while recording
 * @param {boolean} [props.isWriting] - Whether handwriting animation is playing
 * @param {number} [props.audioLevel] - Audio level 0-100 for waveform
 */
export default function VoiceNotePin({
  note,
  stageScale,
  stagePos,
  userColor,
  isOwn,
  onDelete,
  isRecording = false,
  liveTranscript = '',
  isWriting = false,
  audioLevel = 0,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [hovered, setHovered] = useState(false);
  const audioRef = useRef(null);

  const screenX = note.x * stageScale + stagePos.x;
  const screenY = note.y * stageScale + stagePos.y;

  const playAudio = useCallback(() => {
    if (!note.audioUrl) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }
    const audio = new Audio(note.audioUrl);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    audio.play().catch(() => setIsPlaying(false));
    setIsPlaying(true);
  }, [note.audioUrl, isPlaying]);

  const pinColor = note.color || userColor || '#FACC15';

  return (
    <div
      className="absolute z-20 pointer-events-auto"
      style={{ left: screenX - 14, top: screenY - 14 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowFull(false); }}
    >
      {/* ═══ STATE 1: Recording — red pulsing mic ═══ */}
      {isRecording && (
        <>
          <div className="relative w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 border-red-400/50 bg-red-500 animate-pulse">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" />
            </svg>
            {/* Ping ring */}
            <span className="absolute inset-0 rounded-full animate-ping opacity-30 bg-red-500" />
          </div>

          {/* Live transcript bubble */}
          {liveTranscript && (
            <div
              className="mt-1.5 max-w-[240px] text-[10px] leading-tight italic text-white/60 bg-brand-dark/80 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-brand-grey-lt/30 animate-fade-in"
              style={{ wordBreak: 'break-word' }}
            >
              {liveTranscript}
            </div>
          )}

          {/* Waveform mini bars */}
          <div className="flex items-end gap-0.5 h-3 mt-1 justify-center">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-0.5 rounded-full bg-red-400/80 transition-all duration-75"
                style={{ height: Math.max(2, (audioLevel / 100) * 12 * (0.4 + Math.sin(Date.now() / 120 + i * 1.3) * 0.6)) }}
              />
            ))}
          </div>
        </>
      )}

      {/* ═══ STATE 2: Writing — pen icon animation ═══ */}
      {!isRecording && isWriting && (
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 border-blue-400/50 bg-blue-500">
            {/* Pen icon — animated with CSS bounce */}
            <svg className="w-3.5 h-3.5 text-white animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ animationDuration: '0.6s' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <span className="text-[10px] text-blue-400 font-medium whitespace-nowrap animate-pulse">Writing…</span>
        </div>
      )}

      {/* ═══ STATE 3: Complete — normal playback pin ═══ */}
      {!isRecording && !isWriting && (
        <>
          <button
            onClick={playAudio}
            className="relative w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 border-white/30 transition-transform hover:scale-110 cursor-pointer"
            style={{ backgroundColor: pinColor }}
            title={isPlaying ? 'Stop' : 'Play voice note'}
            aria-label={isPlaying ? 'Stop voice note playback' : 'Play voice note'}
          >
            {isPlaying ? (
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" />
              </svg>
            )}
            {/* Playing pulse */}
            {isPlaying && (
              <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: pinColor }} />
            )}
          </button>

          {/* Transcript */}
          {note.transcript && (
            <div
              className="mt-1 max-w-[140px] text-[10px] leading-tight text-white/80 bg-brand-dark/90 rounded px-1.5 py-0.5 border border-brand-grey-lt/40 cursor-pointer"
              onClick={() => setShowFull(!showFull)}
              title={note.transcript}
            >
              <div className={showFull ? '' : 'line-clamp-2'}>{note.transcript}</div>
            </div>
          )}
        </>
      )}

      {/* Delete button (own notes only) */}
      {isOwn && hovered && !isRecording && !isWriting && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(note.id); }}
          className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] leading-none hover:bg-red-400 shadow"
          aria-label="Delete voice note"
        >
          ×
        </button>
      )}
    </div>
  );
}
