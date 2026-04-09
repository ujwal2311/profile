/**
 * analytics.js — Product Analytics (Fire-and-Forget)
 *
 * Tracks events to Supabase analytics_events table.
 * Never blocks UI. Respects localStorage opt-out.
 * Falls back to mock data if Supabase is unavailable.
 */

import { supabase, isSupabaseConfigured } from './supabase';

function isOptedOut() {
  try { return localStorage.getItem('analytics_opt_out') === 'true'; } catch { return false; }
}

/** Fire-and-forget event tracking */
export function track(eventType, metadata = {}) {
  if (isOptedOut() || !isSupabaseConfigured()) return;
  supabase.from('analytics_events').insert({
    event_type: eventType,
    room_id: metadata.roomId || null,
    metadata,
    created_at: new Date().toISOString(),
  }).then(() => {}).catch(() => {});
}

/** Track which 20×20 grid cells a stroke passes through */
export function trackStroke(points, roomId) {
  if (isOptedOut() || !isSupabaseConfigured() || !points || points.length < 4) return;
  const CELL = 200;
  const touched = new Set();
  for (let i = 0; i < points.length - 1; i += 2) {
    const gx = Math.floor(points[i] / CELL);
    const gy = Math.floor(points[i + 1] / CELL);
    if (gx >= 0 && gx < 20 && gy >= 0 && gy < 20) touched.add(`${gx},${gy}`);
  }
  for (const cell of touched) {
    const [gx, gy] = cell.split(',').map(Number);
    supabase.rpc('increment_heatmap', { p_room_id: roomId, p_grid_x: gx, p_grid_y: gy })
      .then(() => {}).catch(() => {});
  }
}

/** Fetch dashboard data (or mock data if Supabase unavailable) */
export async function fetchDashboardData() {
  if (!isSupabaseConfigured()) return getMockData();
  try {
    const [roomsR, strokesR, usersR, toolsR, dailyR, hourlyR, heatR] = await Promise.all([
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'room_created'),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'stroke_drawn'),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'user_joined'),
      supabase.from('analytics_events').select('metadata').eq('event_type', 'stroke_drawn'),
      supabase.from('analytics_events').select('created_at').eq('event_type', 'room_created')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.from('analytics_events').select('created_at').eq('event_type', 'stroke_drawn'),
      supabase.from('canvas_heatmap').select('*'),
    ]);
    const toolCounts = {};
    (toolsR.data || []).forEach(r => { const t = r.metadata?.tool || 'pen'; toolCounts[t] = (toolCounts[t] || 0) + 1; });
    const daily = {};
    (dailyR.data || []).forEach(r => { const d = r.created_at?.slice(0, 10); if (d) daily[d] = (daily[d] || 0) + 1; });
    const hourly = new Array(24).fill(0);
    (hourlyR.data || []).forEach(r => { hourly[new Date(r.created_at).getHours()]++; });
    return {
      totalRooms: roomsR.count || 0, totalStrokes: strokesR.count || 0, totalUsers: usersR.count || 0,
      toolUsage: toolCounts, dailyRooms: daily, hourlyStrokes: hourly, heatmap: heatR.data || [],
      popularTool: Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'pen',
    };
  } catch {
    return getMockData();
  }
}

function getMockData() {
  const daily = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    daily[d] = Math.floor(Math.random() * 20) + 5;
  }
  const hourly = Array.from({ length: 24 }, (_, h) =>
    Math.max(5, Math.floor(Math.sin((h - 6) * Math.PI / 12) * 40 + 50 + Math.random() * 20))
  );
  const heatmap = [];
  for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) {
    const d = Math.sqrt((x - 10) ** 2 + (y - 10) ** 2);
    const c = Math.max(0, Math.floor(80 - d * 8 + Math.random() * 20));
    if (c > 0) heatmap.push({ grid_x: x, grid_y: y, count: c });
  }
  return {
    totalRooms: 847, totalStrokes: 23419, totalUsers: 3182,
    toolUsage: { pen: 14200, eraser: 4300, line: 2100, rect: 1800, circle: 1019 },
    dailyRooms: daily, hourlyStrokes: hourly, heatmap, popularTool: 'pen',
  };
}
