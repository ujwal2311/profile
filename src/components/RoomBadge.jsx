/**
 * RoomBadge.jsx — Room Security Badge
 *
 * Shows a lock/unlock icon in the top bar:
 *   - Closed lock + "PIN Protected" for PIN rooms
 *   - Open lock + "Public Room" for public rooms
 *   - Tooltip with details
 */

import React, { useState } from 'react';

function getPinFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/pin=(\d{4,6})/);
  return match ? match[1] : null;
}

export default function RoomBadge() {
  const [showTooltip, setShowTooltip] = useState(false);
  const hasPIN = !!getPinFromHash();

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        hasPIN
          ? 'bg-brand-yellow/10 border-brand-yellow/30 text-brand-yellow'
          : 'bg-brand-grey border-brand-grey-lt text-brand-grey-txt'
      }`}>
        {hasPIN ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>PIN</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            <span>Public</span>
          </>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-brand-grey border border-brand-grey-lt text-xs text-brand-white whitespace-nowrap shadow-xl z-50 animate-fade-in">
          {hasPIN ? 'PIN protected room — only users with the PIN can join' : 'Public room — anyone with the link can join'}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-2 h-2 bg-brand-grey border-l border-t border-brand-grey-lt rotate-45 translate-y-1" />
        </div>
      )}
    </div>
  );
}
