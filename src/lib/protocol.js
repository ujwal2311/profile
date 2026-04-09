/**
 * protocol.js — WebRTC DataChannel Message Protocol
 *
 * All peer-to-peer messages use typed constants and factory functions.
 * Extended with smart shapes, voice notes, and handwriting messages.
 * Every message that creates a canvas element includes a unique ID.
 */

import { generateStrokeId, generateShapeId, generateVoiceNoteId } from './idGenerator';

export const MSG = {
  // Drawing
  DRAW_STROKE:  'DRAW_STROKE',
  DRAW_SHAPE:   'DRAW_SHAPE',
  DRAW_START:   'DRAW_START',
  DRAW_MOVE:    'DRAW_MOVE',
  DRAW_END:     'DRAW_END',
  CLEAR:        'CLEAR',
  UNDO:         'UNDO',

  // Presence
  CURSOR_MOVE:  'CURSOR_MOVE',
  HELLO:        'HELLO',

  // Voice
  VOICE_NOTE:   'VOICE_NOTE',

  // Handwriting (voice-to-text drawn strokes)
  HANDWRITING_STROKE: 'HANDWRITING_STROKE',

  // Room management
  ROOM_PIN_CHANGED: 'ROOM_PIN_CHANGED',
  SYNC_REQUEST:     'SYNC_REQUEST',
  SYNC_RESPONSE:    'SYNC_RESPONSE',
};

// Drawing — every message includes sender-generated ID
/**
 * @param {string} id - Unique stroke ID from generateStrokeId()
 * @param {number[]} points - Flat [x1,y1,x2,y2,...] points array
 * @param {string} color - Stroke color hex
 * @param {number} size - Brush size in px
 * @param {string} tool - Tool used ('pen'|'eraser')
 * @returns {Object} Protocol message
 */
export const drawStroke = (id, points, color, size, tool) => ({
  type: MSG.DRAW_STROKE, id, points, color, size, tool,
});

/**
 * @param {string} id - Unique shape ID from generateShapeId()
 * @param {string} shapeType - 'rect'|'circle'|'line'|'triangle'
 * @param {Object} shapeParams - Shape-specific parameters
 * @param {string} color - Stroke color hex
 * @param {number} size - Stroke width in px
 * @returns {Object} Protocol message
 */
export const drawShape = (id, shapeType, shapeParams, color, size) => ({
  type: MSG.DRAW_SHAPE, id, shapeType, shapeParams, color, size,
});

/**
 * @param {string} id - Unique stroke ID
 * @param {number} x - Start X
 * @param {number} y - Start Y
 * @param {string} color - Stroke color
 * @param {number} size - Brush size
 * @param {string} tool - Tool name
 * @returns {Object} Protocol message
 */
export const drawStart = (id, x, y, color, size, tool) => ({
  type: MSG.DRAW_START, id, x, y, color, size, tool,
});

/**
 * @param {number} x
 * @param {number} y
 * @returns {Object}
 */
export const drawMove = (x, y) => ({ type: MSG.DRAW_MOVE, x, y });

/** @returns {Object} */
export const drawEnd = () => ({ type: MSG.DRAW_END });

/** @returns {Object} */
export const clearMsg = () => ({ type: MSG.CLEAR });

/** @returns {Object} */
export const undoMsg = () => ({ type: MSG.UNDO });

// Presence
/**
 * @param {number} x
 * @param {number} y
 * @param {string} peerId
 * @returns {Object}
 */
export const cursorMove = (x, y, peerId) => ({ type: MSG.CURSOR_MOVE, x, y, peerId });

/**
 * @param {string} name
 * @param {string} color
 * @returns {Object}
 */
export const helloMsg = (name, color) => ({ type: MSG.HELLO, name, color });

// Voice
/**
 * @param {string} id - Unique voice note ID from generateVoiceNoteId()
 * @param {number} x
 * @param {number} y
 * @param {string} transcript
 * @param {string} peerId
 * @param {string} audioBase64
 * @returns {Object}
 */
export const voiceNoteMsg = (id, x, y, transcript, peerId, audioBase64) => ({
  type: MSG.VOICE_NOTE, id, x, y, transcript, peerId, audioBase64,
});

// Handwriting stroke (sent per animated stroke for live sync)
/**
 * @param {string} id - Unique stroke ID
 * @param {number[]} points - Flat points array
 * @param {string} color
 * @param {number} size
 * @returns {Object}
 */
export const handwritingStrokeMsg = (id, points, color, size) => ({
  type: MSG.HANDWRITING_STROKE, id, points, color, size,
});

// Room management
/**
 * @param {string} newPinHash
 * @returns {Object}
 */
export const roomPinChanged = (newPinHash) => ({ type: MSG.ROOM_PIN_CHANGED, newPinHash });

/** @returns {Object} */
export const syncRequest = () => ({ type: MSG.SYNC_REQUEST });

/**
 * @param {Array} strokes
 * @returns {Object}
 */
export const syncResponse = (strokes) => ({ type: MSG.SYNC_RESPONSE, strokes });
