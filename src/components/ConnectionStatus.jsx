/**
 * ConnectionStatus.jsx — Connection + Server Status
 *
 * Shows:
 *   1. Connection state (idle/connecting/connected/disconnected)
 *   2. Server status badge: green "Primary" or amber "Fallback"
 *   3. Tooltip explaining what each server type means
 *
 * ID FIX: Uses aria-label and className instead of static id attributes.
 */

import React, { useState } from 'react';

const CONN_STATES = {
  idle:         { label: 'Waiting for peer…', dot: 'bg-amber-400', pulse: true },
  connecting:   { label: 'Connecting…',       dot: 'bg-amber-400', pulse: true },
  connected:    { label: 'Connected',         dot: 'bg-emerald-400', pulse: false },
  disconnected: { label: 'Disconnected',      dot: 'bg-red-500',   pulse: false },
};

const SERVER_BADGES = {
  connecting: { label: 'Connecting…', bg: 'bg-brand-grey', border: 'border-brand-grey-lt', text: 'text-brand-grey-txt', dot: 'bg-amber-400' },
  primary:    { label: 'Primary',     bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  fallback:   { label: 'Fallback',    bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400' },
};

const SERVER_TOOLTIPS = {
  primary: 'Connected to your self-hosted signaling server — fast & reliable',
  fallback: 'Using PeerJS public server as fallback — may be less reliable',
  connecting: 'Attempting to connect to signaling server…',
};

/**
 * @param {Object} props
 * @param {string} props.connectionState - 'idle'|'connecting'|'connected'|'disconnected'
 * @param {string} [props.serverStatus='connecting'] - 'primary'|'fallback'|'connecting'
 */
export default function ConnectionStatus({ connectionState, serverStatus = 'connecting' }) {
  const [showServerTooltip, setShowServerTooltip] = useState(false);
  const conn = CONN_STATES[connectionState] || CONN_STATES.idle;
  const server = SERVER_BADGES[serverStatus] || SERVER_BADGES.connecting;

  return (
    <div className="flex items-center gap-2">
      {/* Server badge */}
      <div
        className="relative"
        onMouseEnter={() => setShowServerTooltip(true)}
        onMouseLeave={() => setShowServerTooltip(false)}
      >
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${server.bg} ${server.border} ${server.text}`}
          aria-label={`Server status: ${server.label}`}
        >
          <span className={`inline-flex rounded-full h-2 w-2 ${server.dot}`} />
          <span>{server.label}</span>
        </div>

        {/* Server tooltip */}
        {showServerTooltip && (
          <div className="absolute top-full mt-2 right-0 px-3 py-2 rounded-lg bg-brand-grey border border-brand-grey-lt text-xs text-brand-white whitespace-nowrap shadow-xl z-50 animate-fade-in">
            {SERVER_TOOLTIPS[serverStatus] || SERVER_TOOLTIPS.connecting}
            <div className="absolute bottom-full right-4 w-2 h-2 bg-brand-grey border-l border-t border-brand-grey-lt rotate-45 translate-y-1" />
          </div>
        )}
      </div>

      {/* Connection status */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-grey border border-brand-grey-lt text-xs font-medium"
        aria-label={`Connection: ${conn.label}`}
      >
        <span className="relative flex h-2.5 w-2.5">
          {conn.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${conn.dot}`} />}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${conn.dot}`} />
        </span>
        <span className="text-brand-grey-txt">{conn.label}</span>
      </div>
    </div>
  );
}
