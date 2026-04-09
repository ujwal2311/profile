/**
 * idGenerator.js — Unique ID Generation System
 *
 * Uses nanoid for collision-resistant, compact IDs.
 * Every canvas element, voice note, peer, and room gets a unique
 * prefixed ID that is safe across the entire app lifetime.
 *
 * NEVER use Math.random().toString(), Date.now(), or array indices as IDs.
 */

import { nanoid } from 'nanoid';

/**
 * Generate a unique stroke ID.
 * @returns {string} e.g. 'stroke_V1StGXR8_Z'
 */
export function generateStrokeId() {
  return 'stroke_' + nanoid(10);
}

/**
 * Generate a unique shape ID.
 * @returns {string} e.g. 'shape_k5Xb9cNqoB'
 */
export function generateShapeId() {
  return 'shape_' + nanoid(10);
}

/**
 * Generate a unique voice note ID.
 * @returns {string} e.g. 'vn_A7bkR3pQzY'
 */
export function generateVoiceNoteId() {
  return 'vn_' + nanoid(10);
}

/**
 * Generate a unique peer ID.
 * @returns {string} e.g. 'peer_xK9mQ2nR'
 */
export function generatePeerId() {
  return 'peer_' + nanoid(8);
}

/**
 * Generate a unique room ID.
 * @returns {string} e.g. 'V1StGXR8_ZDj'
 */
export function generateRoomId() {
  return nanoid(12);
}

/**
 * Generate a unique reaction ID.
 * @returns {string} e.g. 'rx_k5Xb9c'
 */
export function generateReactionId() {
  return 'rx_' + nanoid(6);
}

/**
 * Generate a unique bubble ID.
 * @returns {string} e.g. 'bubble_A7bkR3'
 */
export function generateBubbleId() {
  return 'bubble_' + nanoid(6);
}
