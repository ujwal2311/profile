/**
 * PINGate.jsx — PIN Protection Gate Component
 *
 * Shown before the whiteboard when a room has a PIN set.
 * PIN is stored in URL hash (#pin=1234) — never sent to any server.
 *
 * Features:
 *   - Reads expected PIN from window.location.hash
 *   - 3 attempts then 60-second lockout
 *   - Shake animation on wrong PIN
 *   - Stores auth in sessionStorage to avoid re-prompting
 *   - Public rooms (no PIN) render children immediately
 */

import React, { useState, useEffect, useCallback } from 'react';

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 60;

function getPinFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/pin=(\d{4,6})/);
  return match ? match[1] : null;
}

export default function PINGate({ roomId, children }) {
  const expectedPin = getPinFromHash();
  const storageKey = `room-${roomId}-authed`;

  // FIX: Initialize isAuthed synchronously — no PIN = immediately authed
  const [isAuthed, setIsAuthed] = useState(() => {
    if (!expectedPin) return true;
    return sessionStorage.getItem(storageKey) === 'true';
  });

  const [inputPin, setInputPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [shake, setShake] = useState(false);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutEnd) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutEnd - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        setLockoutEnd(null);
        setAttempts(0);
        setError('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutEnd]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    if (lockoutEnd && Date.now() < lockoutEnd) return;

    const trimmedPin = inputPin.trim();
    if (!trimmedPin) {
      setError('Enter the PIN');
      return;
    }

    if (trimmedPin === expectedPin) {
      sessionStorage.setItem(storageKey, 'true');
      setIsAuthed(true);
      setError('');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError('Incorrect PIN');
      setInputPin('');

      // Shake animation
      setShake(true);
      setTimeout(() => setShake(false), 500);

      if (newAttempts >= MAX_ATTEMPTS) {
        const end = Date.now() + LOCKOUT_SECONDS * 1000;
        setLockoutEnd(end);
        setError(`Too many attempts. Try again in ${LOCKOUT_SECONDS} seconds`);
      }
    }
  }, [inputPin, expectedPin, attempts, lockoutEnd, storageKey]);

  // If authed or no PIN, render children immediately
  if (isAuthed) return <>{children}</>;

  const isLockedOut = lockoutEnd && Date.now() < lockoutEnd;

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="bg-brand-dark border border-brand-grey-lt rounded-2xl p-8 shadow-2xl shadow-black/50">
          {/* Lock icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-brand-yellow/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-yellow" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-brand-white text-center mb-2">
            PIN Protected Room
          </h2>
          <p className="text-brand-grey-txt text-sm text-center mb-6">
            Enter the PIN to join this whiteboard
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={inputPin}
              onChange={(e) => {
                setInputPin(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              disabled={isLockedOut}
              placeholder="Enter PIN"
              autoFocus
              className={`w-full px-4 py-4 rounded-xl bg-brand-grey border text-brand-white text-center text-2xl font-mono tracking-[0.5em] placeholder:text-brand-grey-txt placeholder:text-base placeholder:tracking-normal focus:outline-none transition-all ${
                error
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-brand-grey-lt focus:border-brand-yellow'
              } ${shake ? 'animate-shake' : ''} ${isLockedOut ? 'opacity-50 cursor-not-allowed' : ''}`}
            />

            {error && (
              <p className="text-red-400 text-xs text-center mt-2 animate-fade-in">
                {error}
                {isLockedOut && lockoutRemaining > 0 && (
                  <span className="block mt-1 text-brand-grey-txt">
                    Wait {lockoutRemaining}s
                  </span>
                )}
              </p>
            )}

            <button
              type="submit"
              disabled={isLockedOut || !inputPin.trim()}
              className="w-full mt-4 py-3 rounded-xl bg-brand-yellow text-brand-black font-semibold hover:bg-brand-yellow-lt active:bg-brand-yellow-dk transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-yellow/20"
            >
              {isLockedOut ? `Locked (${lockoutRemaining}s)` : 'Join Room'}
            </button>
          </form>

          {!isLockedOut && attempts > 0 && (
            <p className="text-brand-grey-txt text-xs text-center mt-3">
              {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>

        <p className="text-brand-grey-txt text-xs text-center mt-4 opacity-50">
          PIN is verified locally — never sent to any server
        </p>
      </div>
    </div>
  );
}
