/**
 * useRoomPersistence.js — Supabase Room Persistence Hook
 *
 * Features:
 *   - loadRoom(roomId): fetches canvas_data from Supabase
 *   - saveRoom(roomId, canvasDataURL): upserts canvas_data
 *   - Auto-save: debounced save every 10 seconds after drawing activity
 *   - Snapshot history: stores last 5 snapshots as JSONB
 *
 * Gracefully degrades if Supabase is not configured.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const DEBOUNCE_MS = 10000; // 10 seconds
const MAX_SNAPSHOTS = 5;

export default function useRoomPersistence(roomId) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const debounceTimer = useRef(null);
  const pendingDataRef = useRef(null);

  /**
   * Load room data from Supabase
   * Returns { canvasData: string|null, snapshots: array }
   */
  const loadRoom = useCallback(async (rid) => {
    if (!isSupabaseConfigured()) return { canvasData: null, snapshots: [] };

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('canvas_data, snapshots, updated_at')
        .eq('room_id', rid)
        .maybeSingle();

      if (error) {
        console.error('[useRoomPersistence] loadRoom error:', error);
        return { canvasData: null, snapshots: [] };
      }

      if (data) {
        const snaps = data.snapshots || [];
        setSnapshots(snaps);
        if (data.updated_at) setLastSaved(new Date(data.updated_at));
        return { canvasData: data.canvas_data, snapshots: snaps };
      }

      return { canvasData: null, snapshots: [] };
    } catch (err) {
      console.error('[useRoomPersistence] loadRoom exception:', err);
      return { canvasData: null, snapshots: [] };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save room data to Supabase (upsert)
   * Also maintains the last 5 snapshots
   */
  const saveRoom = useCallback(async (rid, canvasDataURL) => {
    if (!isSupabaseConfigured() || !canvasDataURL) return;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();

      // Build new snapshot entry
      const newSnapshot = {
        timestamp: now,
        data: canvasDataURL,
      };

      // Get existing snapshots to maintain the list
      const { data: existing } = await supabase
        .from('rooms')
        .select('snapshots')
        .eq('room_id', rid)
        .maybeSingle();

      let updatedSnapshots = existing?.snapshots || [];
      updatedSnapshots = [...updatedSnapshots, newSnapshot].slice(-MAX_SNAPSHOTS);

      const { error } = await supabase
        .from('rooms')
        .upsert({
          room_id: rid,
          canvas_data: canvasDataURL,
          snapshots: updatedSnapshots,
          updated_at: now,
        }, {
          onConflict: 'room_id',
        });

      if (error) {
        console.error('[useRoomPersistence] saveRoom error:', error);
      } else {
        setLastSaved(new Date(now));
        setSnapshots(updatedSnapshots);
        console.log('[useRoomPersistence] Room saved successfully');
      }
    } catch (err) {
      console.error('[useRoomPersistence] saveRoom exception:', err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Trigger a debounced save — call this after drawing activity
   */
  const triggerDebouncedSave = useCallback((rid, getCanvasDataURL) => {
    pendingDataRef.current = { rid, getCanvasDataURL };

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      const { rid: r, getCanvasDataURL: getter } = pendingDataRef.current || {};
      if (r && getter) {
        const dataURL = typeof getter === 'function' ? getter() : getter;
        if (dataURL) await saveRoom(r, dataURL);
      }
    }, DEBOUNCE_MS);
  }, [saveRoom]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return {
    loadRoom,
    saveRoom,
    triggerDebouncedSave,
    isSaving,
    lastSaved,
    isLoading,
    snapshots,
  };
}
