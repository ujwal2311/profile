/**
 * usePeer.js — PeerJS Initialization Hook with Fallback
 *
 * Connection Strategy:
 *   1. Try self-hosted Railway server first (timeout 5s)
 *   2. If fails, automatically fall back to PeerJS public server (0.peerjs.com)
 *   3. Exposes serverStatus: 'primary' | 'fallback' | 'connecting'
 *
 * IMPORTANT: React 18 StrictMode double-mounts in dev.
 * We guard every setState with mountedRef to avoid the
 * "Should have a queue" internal React error.
 */

import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

const NON_FATAL_ERRORS = ['peer-unavailable', 'unavailable-id'];

// Parse the Railway server URL from env
function parsePeerServerUrl() {
  const url = import.meta.env.VITE_PEER_SERVER_URL;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
      path: '/peerjs',
      secure: parsed.protocol === 'https:',
    };
  } catch {
    return null;
  }
}

const PRIMARY_CONFIG = parsePeerServerUrl();
const FALLBACK_CONFIG = {};

export default function usePeer(customId = null) {
  const [peer, setPeer] = useState(null);
  const [myPeerId, setMyPeerId] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState('connecting');

  // Refs for values needed inside callbacks (avoids stale closures entirely)
  const peerRef = useRef(null);
  const mountedRef = useRef(false);
  const retryTimer = useRef(null);
  const fallbackAttempted = useRef(false);
  const connectionTimeout = useRef(null);
  const readyRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    fallbackAttempted.current = false;
    readyRef.current = false;

    function safeSetState(fn) {
      if (mountedRef.current) fn();
    }

    function createPeer(config, isPrimary, attempt = 0) {
      // Don't create if we already have one or component unmounted
      if (peerRef.current && !peerRef.current.destroyed) return;
      if (!mountedRef.current) return;

      safeSetState(() => setServerStatus('connecting'));

      const opts = { debug: 1, ...config };
      let newPeer;
      try {
        newPeer = customId ? new Peer(customId, opts) : new Peer(opts);
      } catch (err) {
        console.error('[usePeer] Failed to create Peer:', err);
        safeSetState(() => setError(err));
        return;
      }
      peerRef.current = newPeer;

      // Timeout for primary server — if no 'open' in 5s, try fallback
      if (isPrimary) {
        connectionTimeout.current = setTimeout(() => {
          if (mountedRef.current && !readyRef.current && !fallbackAttempted.current) {
            console.warn('[usePeer] Primary server timeout (5s), falling back…');
            if (peerRef.current && !peerRef.current.destroyed) {
              peerRef.current.destroy();
            }
            peerRef.current = null;
            safeSetState(() => setPeer(null));
            fallbackAttempted.current = true;
            createPeer(FALLBACK_CONFIG, false, 0);
          }
        }, 5000);
      }

      newPeer.on('open', (id) => {
        if (connectionTimeout.current) clearTimeout(connectionTimeout.current);
        console.log(`[usePeer] open on ${isPrimary ? 'PRIMARY' : 'FALLBACK'} server, id:`, id);
        readyRef.current = true;
        safeSetState(() => {
          setMyPeerId(id);
          setIsReady(true);
          setError(null);
          setPeer(newPeer);
          setServerStatus(isPrimary ? 'primary' : 'fallback');
        });
      });

      newPeer.on('error', (err) => {
        console.error('[usePeer] error:', err.type, err.message);

        // 'unavailable-id' — PeerJS server still holds our ID (StrictMode remount)
        if (err.type === 'unavailable-id' && attempt < 3) {
          console.log(`[usePeer] ID taken, retrying in 1.5s (attempt ${attempt + 1}/3)…`);
          if (connectionTimeout.current) clearTimeout(connectionTimeout.current);
          if (peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.destroy();
          }
          peerRef.current = null;
          safeSetState(() => setPeer(null));
          retryTimer.current = setTimeout(() => createPeer(config, isPrimary, attempt + 1), 1500);
          return;
        }

        // If primary fails with a fatal error, try fallback
        if (isPrimary && !NON_FATAL_ERRORS.includes(err.type) && !fallbackAttempted.current) {
          console.warn('[usePeer] Primary server failed, falling back…');
          if (connectionTimeout.current) clearTimeout(connectionTimeout.current);
          if (peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.destroy();
          }
          peerRef.current = null;
          safeSetState(() => setPeer(null));
          fallbackAttempted.current = true;
          createPeer(FALLBACK_CONFIG, false, 0);
          return;
        }

        safeSetState(() => {
          setError(err);
          if (!NON_FATAL_ERRORS.includes(err.type)) {
            setIsReady(false);
            readyRef.current = false;
          }
        });
      });

      newPeer.on('disconnected', () => {
        console.warn('[usePeer] disconnected from signaling, reconnecting…');
        if (newPeer && !newPeer.destroyed) {
          try { newPeer.reconnect(); } catch { /* already destroyed */ }
        }
      });

      newPeer.on('close', () => {
        safeSetState(() => {
          setIsReady(false);
          readyRef.current = false;
          setPeer(null);
        });
      });
    }

    // Try primary first, if available; otherwise go straight to fallback
    if (PRIMARY_CONFIG) {
      createPeer(PRIMARY_CONFIG, true, 0);
    } else {
      createPeer(FALLBACK_CONFIG, false, 0);
    }

    return () => {
      mountedRef.current = false;
      readyRef.current = false;
      clearTimeout(retryTimer.current);
      clearTimeout(connectionTimeout.current);
      if (peerRef.current && !peerRef.current.destroyed) {
        peerRef.current.destroy();
      }
      peerRef.current = null;
    };
  }, [customId]);

  return { peer, myPeerId, isReady, error, serverStatus };
}
