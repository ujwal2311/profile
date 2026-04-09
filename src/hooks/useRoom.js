/**
 * useRoom.js — Room Connection Management
 *
 * Host: waits for incoming peer.on('connection')
 * Guest: calls peer.connect(roomId) to reach host
 * Reconnection: guest retries every 3s up to 5 times if connection drops
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const MAX_RETRIES = 5;
const RETRY_MS = 3000;

export default function useRoom({ peer, roomId, isHost, isReady }) {
  const connRef = useRef(null);
  const handlersRef = useRef([]);
  const retriesRef = useRef(0);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const [isConnected, setIsConnected] = useState(false);
  const [remotePeerId, setRemotePeerId] = useState('');
  const [connectionState, setConnectionState] = useState('idle');

  const onData = useCallback((cb) => {
    handlersRef.current.push(cb);
    return () => { handlersRef.current = handlersRef.current.filter((h) => h !== cb); };
  }, []);

  const sendData = useCallback((data) => {
    if (connRef.current && connRef.current.open) connRef.current.send(data);
  }, []);

  // Use a ref for the reconnect function so wireConnection can reference it
  // without creating a circular useCallback dependency.
  const tryReconnectRef = useRef(null);

  const wireConnection = useCallback((conn) => {
    connRef.current = conn;
    if (mountedRef.current) setConnectionState('connecting');

    conn.on('open', () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      setRemotePeerId(conn.peer);
      setConnectionState('connected');
      retriesRef.current = 0;
    });

    conn.on('data', (data) => {
      handlersRef.current.forEach((h) => h(data));
    });

    conn.on('close', () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      setConnectionState('disconnected');
      connRef.current = null;
      // Guest auto-reconnects
      if (!isHost && tryReconnectRef.current) {
        tryReconnectRef.current();
      }
    });

    conn.on('error', (err) => {
      console.error('[useRoom] conn error:', err);
      if (mountedRef.current) setConnectionState('disconnected');
    });
  }, [isHost]);

  // Keep tryReconnectRef in sync
  tryReconnectRef.current = () => {
    if (retriesRef.current >= MAX_RETRIES) {
      if (mountedRef.current) setConnectionState('disconnected');
      return;
    }
    retriesRef.current++;
    if (mountedRef.current) setConnectionState('connecting');
    timerRef.current = setTimeout(() => {
      if (peer && !peer.destroyed && mountedRef.current) {
        wireConnection(peer.connect(roomId, { reliable: true }));
      }
    }, RETRY_MS);
  };

  useEffect(() => {
    mountedRef.current = true;

    if (!peer || !isReady || !roomId) return;

    if (isHost) {
      setConnectionState('idle');
      const handler = (conn) => wireConnection(conn);
      peer.on('connection', handler);
      return () => {
        mountedRef.current = false;
        peer.off('connection', handler);
        if (connRef.current) connRef.current.close();
        clearTimeout(timerRef.current);
      };
    } else {
      setConnectionState('connecting');
      const conn = peer.connect(roomId, { reliable: true });
      wireConnection(conn);
      return () => {
        mountedRef.current = false;
        if (connRef.current) connRef.current.close();
        clearTimeout(timerRef.current);
      };
    }
  }, [peer, isReady, roomId, isHost, wireConnection]);

  return { isConnected, remotePeerId, sendData, onData, connectionState };
}
