/**
 * server.js — Self-hosted PeerJS Signaling Server
 *
 * Mounts a PeerJS server on Express with:
 *   - Health check endpoint: GET /alive → 200 OK
 *   - PeerJS signaling at path /peerjs
 *   - CORS enabled for Vercel deployment domain
 *   - Connection/disconnection logging
 *
 * Deploy to Railway.app for reliable signaling.
 */

const express = require('express');
const cors = require('cors');
const { ExpressPeerServer } = require('peer');

const app = express();
const PORT = process.env.PORT || 9000;

// ── CORS ────────────────────────────────────────────────────
// Allow your Vercel frontend + localhost dev
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'https://your-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) return cb(null, true);
    // In production you might want to restrict this more
    return cb(null, true);
  },
  credentials: true,
}));

// ── Health Check ────────────────────────────────────────────
app.get('/alive', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    connections: peerServer ? peerServer._clients?.peerjs?.size || 0 : 0,
  });
});

// ── Root ─────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'Live Whiteboard PeerJS Signaling Server',
    health: '/alive',
    peerjs: '/peerjs',
  });
});

// ── Start HTTP Server ───────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`🚀 PeerJS Signaling Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/alive`);
  console.log(`   PeerJS path:  /peerjs`);
});

// ── Mount PeerJS ────────────────────────────────────────────
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/',          // mounted under /peerjs by app.use below
  allow_discovery: false,
  proxied: true,      // Required for Railway (behind reverse proxy)
});

app.use('/peerjs', peerServer);

// ── Connection Logging ──────────────────────────────────────
peerServer.on('connection', (client) => {
  console.log(`✅ Peer connected:    ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`❌ Peer disconnected: ${client.getId()}`);
});

peerServer.on('error', (err) => {
  console.error('⚠️  PeerJS server error:', err);
});

// ── Graceful Shutdown ───────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down…');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down…');
  server.close(() => process.exit(0));
});
