/**
 * Dashboard.jsx — Product Analytics Dashboard
 *
 * Shows usage metrics with Chart.js visualizations.
 * Uses mock data if Supabase is not configured.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { fetchDashboardData } from '../lib/analytics';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
);

const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#9CA3AF', font: { family: 'Inter', size: 11 } } },
    tooltip: {
      backgroundColor: '#1E1E1E', titleColor: '#F5F5F5', bodyColor: '#9CA3AF',
      borderColor: '#2A2A2A', borderWidth: 1, cornerRadius: 8, padding: 12,
    },
  },
  scales: {
    x: { grid: { color: '#1E1E1E' }, ticks: { color: '#6B7280', font: { size: 10 } } },
    y: { grid: { color: '#1E1E1E' }, ticks: { color: '#6B7280', font: { size: 10 } } },
  },
};

function MetricCard({ label, value, icon, accent }) {
  return (
    <div className="bg-brand-dark border border-brand-grey-lt rounded-2xl p-6 flex items-center gap-4 hover:border-brand-yellow/40 transition-colors">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${accent}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-brand-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className="text-brand-grey-txt text-xs mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function Heatmap({ data }) {
  const maxCount = Math.max(1, ...(data || []).map(d => d.count));
  const grid = Array.from({ length: 20 }, () => Array(20).fill(0));
  (data || []).forEach(d => {
    if (d.grid_x >= 0 && d.grid_x < 20 && d.grid_y >= 0 && d.grid_y < 20)
      grid[d.grid_y][d.grid_x] = d.count;
  });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 2 }}>
      {grid.flat().map((count, i) => {
        const t = count / maxCount;
        const bg = t === 0 ? '#141414' : `hsl(210, 100%, ${Math.round(70 - t * 50)}%)`;
        return <div key={i} style={{ backgroundColor: bg, aspectRatio: '1', borderRadius: 2 }} />;
      })}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData().then(d => { setData(d); setLoading(false); });
  }, []);

  const lineData = useMemo(() => {
    if (!data) return null;
    const labels = Object.keys(data.dailyRooms).sort();
    return {
      labels: labels.map(d => d.slice(5)),
      datasets: [{
        label: 'Rooms Created', data: labels.map(d => data.dailyRooms[d]),
        borderColor: '#FACC15', backgroundColor: 'rgba(250,204,21,0.08)',
        fill: true, tension: 0.4, pointRadius: 2, pointBackgroundColor: '#FACC15',
      }],
    };
  }, [data]);

  const barData = useMemo(() => {
    if (!data) return null;
    return {
      labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
      datasets: [{
        label: 'Strokes', data: data.hourlyStrokes,
        backgroundColor: 'rgba(250,204,21,0.5)', borderColor: '#FACC15',
        borderWidth: 1, borderRadius: 4,
      }],
    };
  }, [data]);

  const doughnutData = useMemo(() => {
    if (!data) return null;
    const labels = Object.keys(data.toolUsage);
    const colors = ['#FACC15', '#3B82F6', '#EF4444', '#22C55E', '#A855F7', '#F97316'];
    return {
      labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [{
        data: labels.map(l => data.toolUsage[l]),
        backgroundColor: colors.slice(0, labels.length),
        borderColor: '#141414', borderWidth: 3,
      }],
    };
  }, [data]);

  const doughnutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#9CA3AF', padding: 16, font: { family: 'Inter', size: 11 } } },
      tooltip: BASE_OPTS.plugins.tooltip,
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-3 border-brand-grey-lt border-t-brand-yellow rounded-full animate-spin" />
          <p className="text-brand-grey-txt text-sm">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black text-brand-white overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-brand-dark/90 backdrop-blur-md border-b border-brand-grey-lt px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-brand-grey-txt hover:text-brand-yellow transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
            </Link>
            <h1 className="text-xl font-bold">
              <span className="text-brand-yellow">Analytics</span> Dashboard
            </h1>
          </div>
          <span className="text-brand-grey-txt text-xs">Live Whiteboard</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Rooms" value={data?.totalRooms || 0} icon="🏠" accent="bg-brand-yellow/10" />
          <MetricCard label="Total Strokes" value={data?.totalStrokes || 0} icon="✏️" accent="bg-blue-500/10" />
          <MetricCard label="Total Users" value={data?.totalUsers || 0} icon="👥" accent="bg-emerald-500/10" />
          <MetricCard label="Popular Tool" value={data?.popularTool || 'pen'} icon="⭐" accent="bg-purple-500/10" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rooms per Day */}
          <div className="bg-brand-dark border border-brand-grey-lt rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-brand-grey-txt uppercase tracking-wider mb-4">Rooms Created (30 days)</h3>
            <div style={{ height: 260 }}>
              {lineData && <Line data={lineData} options={BASE_OPTS} />}
            </div>
          </div>

          {/* Strokes by Hour */}
          <div className="bg-brand-dark border border-brand-grey-lt rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-brand-grey-txt uppercase tracking-wider mb-4">Activity by Hour</h3>
            <div style={{ height: 260 }}>
              {barData && <Bar data={barData} options={BASE_OPTS} />}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tool Usage */}
          <div className="bg-brand-dark border border-brand-grey-lt rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-brand-grey-txt uppercase tracking-wider mb-4">Tool Usage</h3>
            <div style={{ height: 280 }}>
              {doughnutData && <Doughnut data={doughnutData} options={doughnutOpts} />}
            </div>
          </div>

          {/* Heatmap */}
          <div className="bg-brand-dark border border-brand-grey-lt rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-brand-grey-txt uppercase tracking-wider mb-4">Where People Draw Most</h3>
            <Heatmap data={data?.heatmap} />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-brand-grey-txt">Less</span>
              <div className="flex gap-0.5">
                {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => (
                  <div key={i} className="w-4 h-3 rounded-sm"
                    style={{ backgroundColor: t === 0 ? '#141414' : `hsl(210,100%,${Math.round(70 - t * 50)}%)` }} />
                ))}
              </div>
              <span className="text-[10px] text-brand-grey-txt">More</span>
            </div>
          </div>
        </div>

        <p className="text-center text-brand-grey-txt text-xs opacity-50 pb-8">
          Data updates in real-time • Analytics are privacy-respecting
        </p>
      </main>
    </div>
  );
}
