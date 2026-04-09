/**
 * Toolbar.jsx — Drawing Toolbar with Mobile Bottom Sheet
 *
 * Desktop: vertical sidebar on the left
 * Mobile (<768px): bottom sheet drawer with handle
 * Includes: tools, colors, brush size, zoom, smart shapes toggle, voice tool
 *
 * ID COLLISION FIX: No static IDs on repeated elements.
 * Tool buttons use data-tool attribute instead of id.
 * Color swatches use aria-label for identification.
 */

import React, { useState, useEffect, useCallback } from 'react';

const PRESETS = ['#FACC15','#F5F5F5','#EF4444','#3B82F6','#22C55E','#A855F7','#F97316','#EC4899'];

const TOOLS = [
  { id:'pen',    label:'Pen',        key:'P', d:'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  { id:'eraser', label:'Eraser',     key:'E', d:'M5.505 14.505l4.99 4.99M3 18l6.5-6.5 4 4L7 22H3v-4zm16.5-11.5a2.121 2.121 0 00-3-3L9 11l3 3 7.5-7.5z' },
  { id:'line',   label:'Line',       key:'L', d:'M4 20L20 4' },
  { id:'rect',   label:'Rectangle',  key:'R', d:'M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z' },
  { id:'circle', label:'Circle',     key:'C', d:'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z' },
  { id:'voice',  label:'Voice Note', key:'V', d:'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8' },
];

/**
 * @param {Object} props
 * @param {string} props.tool - Active tool ID
 * @param {Function} props.setTool
 * @param {string} props.color - Active color hex
 * @param {Function} props.setColor
 * @param {number} props.brushSize
 * @param {Function} props.setBrushSize
 * @param {Function} props.onUndo
 * @param {Function} props.onClear
 * @param {Function} props.onExport
 * @param {Function} props.zoomIn
 * @param {Function} props.zoomOut
 * @param {Function} props.resetZoom
 * @param {number} props.stageScale
 * @param {boolean} props.smartShapes
 * @param {Function} props.setSmartShapes
 */
export default function Toolbar({
  tool, setTool, color, setColor, brushSize, setBrushSize,
  onUndo, onClear, onExport,
  zoomIn, zoomOut, resetZoom, stageScale,
  smartShapes, setSmartShapes,
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleClear = useCallback(() => {
    if (confirmClear) { onClear(); setConfirmClear(false); }
    else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); }
  }, [confirmClear, onClear]);

  const activeTool = TOOLS.find((t) => t.id === tool) || TOOLS[0];

  // ═══ MOBILE BOTTOM SHEET ═══
  if (isMobile) {
    return (
      <>
        {/* Floating active tool pill */}
        <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-40 animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-dark/95 backdrop-blur-md border border-brand-grey-lt shadow-lg text-xs">
            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-brand-yellow text-brand-black">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={activeTool.d}/>
              </svg>
            </div>
            <span className="text-brand-white font-medium">{activeTool.label}</span>
            <div className="w-3 h-3 rounded-full border border-brand-grey-lt" style={{ backgroundColor: color }} />
            <span className="text-brand-grey-txt">{brushSize}px</span>
          </div>
        </div>

        {/* Bottom sheet drawer */}
        <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-out ${
          drawerOpen ? 'translate-y-0' : 'translate-y-[calc(100%-64px)]'
        }`}>
          <div
            className="flex justify-center py-2 cursor-pointer bg-brand-dark/95 backdrop-blur-md border-t border-brand-grey-lt rounded-t-2xl"
            onClick={() => setDrawerOpen(!drawerOpen)}
          >
            <div className="w-10 h-1 rounded-full bg-brand-grey-mid" />
          </div>

          <div className="bg-brand-dark/95 backdrop-blur-md border-t border-brand-grey-lt px-3 pb-4 max-h-[320px] overflow-y-auto">
            {/* Row 1: Tools */}
            <div className="flex items-center gap-1 py-2 overflow-x-auto">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  data-tool={t.id}
                  onClick={() => setTool(t.id)}
                  aria-label={`${t.label} tool`}
                  className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all shrink-0 ${
                    tool === t.id
                      ? 'bg-brand-yellow text-brand-black shadow-md shadow-brand-yellow/30'
                      : 'text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white'
                  }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={t.d}/>
                  </svg>
                </button>
              ))}

              <div className="w-px h-8 bg-brand-grey-lt mx-1 shrink-0" />

              {/* Smart Shapes toggle */}
              {setSmartShapes && (
                <button
                  onClick={() => setSmartShapes(!smartShapes)}
                  title="Smart Shapes"
                  aria-label={`Smart Shapes ${smartShapes ? 'enabled' : 'disabled'}`}
                  className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all shrink-0 ${
                    smartShapes ? 'bg-emerald-500/20 text-emerald-400' : 'text-brand-grey-txt hover:bg-brand-grey-mid'
                  }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                  </svg>
                </button>
              )}

              <div className="w-px h-8 bg-brand-grey-lt mx-1 shrink-0" />

              <button
                onClick={onUndo}
                aria-label="Undo"
                className="flex items-center justify-center w-11 h-11 rounded-xl text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white transition-all shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4"/>
                </svg>
              </button>

              <button
                onClick={handleClear}
                aria-label={confirmClear ? 'Confirm clear canvas' : 'Clear canvas'}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all shrink-0 ${
                  confirmClear ? 'bg-red-500/20 text-red-400' : 'text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white'
                }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>

              <button
                onClick={onExport}
                aria-label="Export PNG"
                className="flex items-center justify-center w-11 h-11 rounded-xl text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white transition-all shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
              </button>
            </div>

            {/* Row 2: Colors */}
            <div className="flex items-center gap-2 py-2 overflow-x-auto">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`w-8 h-8 rounded-full border-2 transition-transform shrink-0 ${
                    color === c ? 'border-brand-yellow scale-125' : 'border-brand-grey-lt hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }} />
              ))}
              <div className="relative w-8 h-8 shrink-0">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="Custom color picker"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-brand-grey-txt"
                  style={{ background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)' }} />
              </div>
            </div>

            {/* Row 3: Brush size */}
            <div className="flex items-center gap-3 py-2 px-1">
              <span className="text-xs text-brand-grey-txt w-8">{brushSize}px</span>
              <input
                type="range"
                min="2"
                max="40"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                aria-label="Brush size slider"
                className="flex-1 h-1 accent-brand-yellow cursor-pointer" />
            </div>

            {/* Row 4: Zoom controls */}
            {zoomIn && (
              <div className="flex items-center gap-2 py-2 border-t border-brand-grey-lt/50 mt-1 pt-3">
                <span className="text-xs text-brand-grey-txt">Zoom:</span>
                <button onClick={zoomOut} aria-label="Zoom out" className="px-3 py-1.5 rounded-lg bg-brand-grey text-brand-white text-sm hover:bg-brand-grey-mid transition-colors">−</button>
                <span className="text-xs text-brand-white min-w-[3rem] text-center">{Math.round(stageScale * 100)}%</span>
                <button onClick={zoomIn} aria-label="Zoom in" className="px-3 py-1.5 rounded-lg bg-brand-grey text-brand-white text-sm hover:bg-brand-grey-mid transition-colors">+</button>
                <button onClick={resetZoom} aria-label="Reset zoom" className="px-3 py-1.5 rounded-lg bg-brand-grey text-brand-grey-txt text-xs hover:bg-brand-grey-mid hover:text-brand-white transition-colors ml-auto">Reset</button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ═══ DESKTOP SIDEBAR ═══
  return (
    <div className="fixed z-40 left-3 top-1/2 -translate-y-1/2 flex-col w-14 flex items-stretch bg-brand-dark/95 backdrop-blur-md border border-brand-grey-lt rounded-2xl p-2 gap-1 shadow-2xl shadow-black/40">
      {/* Tools */}
      {TOOLS.map((t) => (
        <button
          key={t.id}
          data-tool={t.id}
          onClick={() => setTool(t.id)}
          title={`${t.label} (${t.key})`}
          aria-label={`${t.label} tool`}
          className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all shrink-0 ${
            tool === t.id
              ? 'bg-brand-yellow text-brand-black shadow-md shadow-brand-yellow/30'
              : 'text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white'
          }`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={t.d}/>
          </svg>
          <span className="hidden group-hover:block absolute left-full ml-2 px-2 py-1 rounded bg-brand-grey text-brand-white text-xs whitespace-nowrap border border-brand-grey-lt z-50">
            {t.label} <kbd className="ml-1 px-1 py-0.5 bg-brand-grey-mid rounded text-[10px]">{t.key}</kbd>
          </span>
        </button>
      ))}

      <div className="w-full h-px bg-brand-grey-lt my-1 shrink-0"/>

      {/* Smart Shapes toggle */}
      {setSmartShapes && (
        <>
          <button
            onClick={() => setSmartShapes(!smartShapes)}
            title="Smart Shapes (S)"
            aria-label={`Smart Shapes ${smartShapes ? 'enabled' : 'disabled'}`}
            className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all shrink-0 ${
              smartShapes ? 'bg-emerald-500/20 text-emerald-400' : 'text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white'
            }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
            </svg>
            <span className="hidden group-hover:block absolute left-full ml-2 px-2 py-1 rounded bg-brand-grey text-brand-white text-xs whitespace-nowrap border border-brand-grey-lt z-50">
              Smart Shapes {smartShapes ? 'ON' : 'OFF'} <kbd className="ml-1 px-1 py-0.5 bg-brand-grey-mid rounded text-[10px]">S</kbd>
            </span>
          </button>
          <div className="w-full h-px bg-brand-grey-lt my-1 shrink-0"/>
        </>
      )}

      {/* Colors */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        {PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            title={c}
            aria-label={`Color ${c}`}
            className={`w-6 h-6 rounded-full border-2 transition-transform shrink-0 ${
              color === c ? 'border-brand-yellow scale-125' : 'border-brand-grey-lt hover:scale-110'
            }`}
            style={{ backgroundColor: c }}/>
        ))}
        <div className="relative w-6 h-6 shrink-0">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Custom color picker"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
          <div className="w-6 h-6 rounded-full border-2 border-dashed border-brand-grey-txt"
            style={{ background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)' }}/>
        </div>
      </div>

      <div className="w-full h-px bg-brand-grey-lt my-1 shrink-0"/>

      {/* Brush size */}
      <div className="flex flex-col items-center gap-1 shrink-0 px-1">
        <span className="text-[10px] text-brand-grey-txt">{brushSize}px</span>
        <input
          type="range"
          min="2"
          max="40"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          aria-label="Brush size slider"
          className="w-20 h-1 accent-brand-yellow cursor-pointer"/>
      </div>

      <div className="w-full h-px bg-brand-grey-lt my-1 shrink-0"/>

      {/* Undo */}
      <button
        onClick={onUndo}
        title="Undo (U)"
        aria-label="Undo"
        className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white transition-all shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4"/>
        </svg>
        <span className="hidden group-hover:block absolute left-full ml-2 px-2 py-1 rounded bg-brand-grey text-brand-white text-xs whitespace-nowrap border border-brand-grey-lt z-50">Undo <kbd className="ml-1 px-1 py-0.5 bg-brand-grey-mid rounded text-[10px]">U</kbd></span>
      </button>

      {/* Clear */}
      <button
        onClick={handleClear}
        title="Clear (Ctrl+Shift+Del)"
        aria-label={confirmClear ? 'Confirm clear canvas' : 'Clear canvas'}
        className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all shrink-0 ${
          confirmClear ? 'bg-red-500/20 text-red-400' : 'text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white'
        }`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        <span className="hidden group-hover:block absolute left-full ml-2 px-2 py-1 rounded bg-brand-grey text-brand-white text-xs whitespace-nowrap border border-brand-grey-lt z-50">{confirmClear ? 'Click again to confirm' : 'Clear'}</span>
      </button>

      {/* Export */}
      <button
        onClick={onExport}
        title="Export PNG"
        aria-label="Export PNG"
        className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white transition-all shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        <span className="hidden group-hover:block absolute left-full ml-2 px-2 py-1 rounded bg-brand-grey text-brand-white text-xs whitespace-nowrap border border-brand-grey-lt z-50">Export PNG</span>
      </button>

      {/* Zoom controls */}
      {zoomIn && (
        <>
          <div className="w-full h-px bg-brand-grey-lt my-1 shrink-0"/>
          <button
            onClick={zoomIn}
            title="Zoom In"
            aria-label="Zoom in"
            className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white transition-all shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/>
            </svg>
          </button>
          <button
            onClick={zoomOut}
            title="Zoom Out"
            aria-label="Zoom out"
            className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white transition-all shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"/>
            </svg>
          </button>
          <button
            onClick={resetZoom}
            title={`Reset Zoom (${Math.round((stageScale || 1) * 100)}%)`}
            aria-label="Reset zoom"
            className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-brand-grey-txt hover:bg-brand-grey-mid hover:text-brand-white transition-all shrink-0 text-[10px] font-mono">
            {Math.round((stageScale || 1) * 100)}%
          </button>
        </>
      )}
    </div>
  );
}
