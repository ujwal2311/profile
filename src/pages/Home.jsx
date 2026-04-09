/**
 * Home.jsx — Landing Page with Room Creation + PIN Protection
 *
 * Features:
 *   - Create a room with optional 4-6 digit PIN
 *   - PIN encoded in URL hash (#pin=1234) — never sent to server
 *   - Join a room by ID (with PIN input if the invite link has a PIN)
 *   - Copy invite link includes PIN hash
 */

import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { nanoid } from 'nanoid';

export default function Home() {
  const nav = useNavigate();
  const [joinId, setJoinId] = useState('');
  const [err, setErr] = useState('');

  // PIN creation state
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Join PIN state
  const [joinPin, setJoinPin] = useState('');
  const [showJoinPin, setShowJoinPin] = useState(false);

  const create = useCallback(() => {
    if (showPinSetup && pin) {
      // Validate PIN: 4-6 digits
      if (!/^\d{4,6}$/.test(pin)) {
        setPinError('PIN must be 4-6 digits');
        return;
      }
    }

    const roomId = nanoid(10);
    const pinHash = pin ? `#pin=${pin}` : '';
    nav(`/room/${roomId}?host=true${pinHash}`);
  }, [nav, showPinSetup, pin]);

  const join = useCallback(() => {
    const id = joinId.trim();
    if (!id) { setErr('Enter a Room ID'); return; }
    setErr('');

    // If user entered a PIN for joining
    const pinHash = joinPin ? `#pin=${joinPin}` : '';
    nav(`/room/${id}${pinHash}`);
  }, [nav, joinId, joinPin]);

  const handlePinChange = useCallback((val) => {
    setPin(val.replace(/\D/g, '').slice(0, 6));
    setPinError('');
  }, []);

  return (
    <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center px-4 py-10 overflow-auto">

      {/* Hero */}
      <div className="text-center mb-10 animate-fade-in">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-3">
          <span className="text-brand-yellow">Live</span>{' '}
          <span className="text-brand-white">Whiteboard</span>
        </h1>
        <p className="text-brand-grey-txt text-lg max-w-md mx-auto">
          Real-time collaborative drawing — peer-to-peer, no sign-up, no server.
        </p>
      </div>

      {/* Cards */}
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl mb-14 animate-slide-up">

        {/* Create */}
        <div className="flex-1 bg-brand-dark border border-brand-grey-lt rounded-2xl p-8 flex flex-col items-center hover:border-brand-yellow transition-colors">
          <div className="w-14 h-14 rounded-full bg-brand-yellow/10 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-brand-yellow" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-brand-white mb-2">Create a Room</h2>
          <p className="text-brand-grey-txt text-sm text-center mb-4">Start a new whiteboard and share the link.</p>

          {/* PIN toggle */}
          <button
            onClick={() => { setShowPinSetup(!showPinSetup); setPin(''); setPinError(''); }}
            className="flex items-center gap-2 text-xs text-brand-grey-txt hover:text-brand-yellow transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {showPinSetup ? 'Remove PIN protection' : 'Add PIN protection (optional)'}
          </button>

          {/* PIN input */}
          {showPinSetup && (
            <div className="w-full mb-4 animate-fade-in">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="Enter 4-6 digit PIN"
                className="w-full px-4 py-3 rounded-xl bg-brand-grey border border-brand-grey-lt text-brand-white placeholder:text-brand-grey-txt focus:outline-none focus:border-brand-yellow transition-colors text-center font-mono tracking-widest"
              />
              {pinError && <p className="text-red-400 text-xs text-center mt-1">{pinError}</p>}
              <p className="text-brand-grey-txt text-xs text-center mt-1 opacity-70">
                PIN stays in URL — never sent to any server
              </p>
            </div>
          )}

          <button id="btn-create" onClick={create}
            className="w-full py-3 rounded-xl bg-brand-yellow text-brand-black font-semibold hover:bg-brand-yellow-lt active:bg-brand-yellow-dk transition-colors shadow-lg shadow-brand-yellow/20">
            {showPinSetup && pin ? '🔒 Create Protected Room' : 'Create Room'}
          </button>
        </div>

        {/* Join */}
        <div className="flex-1 bg-brand-dark border border-brand-grey-lt rounded-2xl p-8 flex flex-col items-center hover:border-brand-yellow transition-colors">
          <div className="w-14 h-14 rounded-full bg-brand-yellow/10 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-brand-yellow" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-brand-white mb-2">Join a Room</h2>
          <p className="text-brand-grey-txt text-sm text-center mb-4">Enter a Room ID to start drawing together.</p>
          <input id="input-room-id" type="text" value={joinId}
            onChange={(e) => { setJoinId(e.target.value); setErr(''); }}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            placeholder="Paste Room ID"
            className="w-full px-4 py-3 rounded-xl bg-brand-grey border border-brand-grey-lt text-brand-white placeholder:text-brand-grey-txt focus:outline-none focus:border-brand-yellow transition-colors mb-3 text-center"/>

          {/* Optional PIN for joining */}
          <button
            onClick={() => setShowJoinPin(!showJoinPin)}
            className="flex items-center gap-1 text-xs text-brand-grey-txt hover:text-brand-yellow transition-colors mb-3"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {showJoinPin ? 'Hide PIN' : 'Room has a PIN?'}
          </button>

          {showJoinPin && (
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={joinPin}
              onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter room PIN"
              className="w-full px-4 py-3 rounded-xl bg-brand-grey border border-brand-grey-lt text-brand-white placeholder:text-brand-grey-txt focus:outline-none focus:border-brand-yellow transition-colors mb-3 text-center font-mono tracking-widest animate-fade-in"
            />
          )}

          {err && <p className="text-red-400 text-xs mb-2">{err}</p>}
          <button id="btn-join" onClick={join}
            className="w-full py-3 rounded-xl bg-brand-grey-mid text-brand-white font-semibold hover:bg-brand-yellow hover:text-brand-black transition-colors">
            Join Room
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="w-full max-w-2xl animate-slide-up" style={{ animationDelay: '.15s' }}>
        <h3 className="text-center text-brand-grey-txt text-sm font-semibold uppercase tracking-widest mb-6">How It Works</h3>
        <div className="flex flex-col md:flex-row gap-4">
          {[
            { n: '1', t: 'Create', d: 'Generate a unique room link with one click.' },
            { n: '2', t: 'Share',  d: 'Send the link — add a PIN for privacy.' },
            { n: '3', t: 'Draw',   d: 'See each other\'s strokes live, peer-to-peer.' },
          ].map((s) => (
            <div key={s.n} className="flex-1 bg-brand-grey/40 rounded-xl p-5 text-center border border-brand-grey-lt/50">
              <div className="w-10 h-10 rounded-full bg-brand-yellow text-brand-black font-bold flex items-center justify-center mx-auto mb-3 text-sm">{s.n}</div>
              <h4 className="text-brand-white font-semibold mb-1">{s.t}</h4>
              <p className="text-brand-grey-txt text-xs">{s.d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 flex items-center gap-4">
        <p className="text-brand-grey-txt text-xs opacity-50">Powered by WebRTC • No data stored on any server</p>
        <Link to="/dashboard" className="flex items-center gap-1.5 text-brand-grey-txt text-xs hover:text-brand-yellow transition-colors opacity-70 hover:opacity-100">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Analytics
        </Link>
      </div>
    </div>
  );
}
