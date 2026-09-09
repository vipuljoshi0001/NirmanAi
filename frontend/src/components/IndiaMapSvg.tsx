import React, { useState } from 'react';
import indiaMap from '@svg-maps/india';
import { StateProjectData } from '../types';

interface IndiaMapSvgProps {
  selectedStateId: string;
  hoveredStateId: string | null;
  onSelectState: (stateId: string) => void;
  onHoverState: (stateId: string | null) => void;
  stateDataMap: Record<string, StateProjectData>;
}

export const IndiaMapSvg: React.FC<IndiaMapSvgProps> = ({
  selectedStateId,
  hoveredStateId,
  onSelectState,
  onHoverState,
  stateDataMap
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);

  const width = 612;
  const height = 696;

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 2.4));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  /**
   * Determine state fill color based on project density according to official specification:
   * - High Density (>100 Projects): Dark Blue (#1e40af / #1d4ed8)
   * - Medium Density (50-100 Projects): Medium Blue (#3b82f6 / #60a5fa)
   * - Emerging (<50 Projects): Light Blue (#93c5fd / #bfdbfe)
   */
  const getStateFillColor = (stateId: string, isSelected: boolean, isHovered: boolean) => {
    const data = stateDataMap[stateId.toLowerCase()];
    const count = data ? data.totalProjects : 24;

    if (isSelected) {
      return '#1e3a8a'; // Deepest rich blue for active selected state (e.g. Maharashtra)
    }

    if (isHovered) {
      return '#2563eb'; // Bright royal blue on hover / touch inspection
    }

    if (count >= 100) {
      return '#1e40af'; // High density (>100)
    } else if (count >= 50) {
      return '#3b82f6'; // Medium density (50-100)
    } else {
      return '#93c5fd'; // Emerging (<50)
    }
  };

  return (
    <div 
      id="geographic-india-map-container"
      className="relative w-full h-[380px] sm:h-[430px] md:h-[460px] bg-slate-50/70 rounded-xl flex items-center justify-center overflow-hidden select-none border border-slate-100"
    >
      {/* Zoom / Pan Navigation Overlay (Top Left matching reference) */}
      <div className="absolute top-3.5 left-3.5 z-20 flex flex-col bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden text-slate-700">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In"
          className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 text-sm font-bold border-b border-slate-200 transition-colors cursor-pointer"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 text-sm font-bold border-b border-slate-200 transition-colors cursor-pointer"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          title="Reset Extent"
          className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 text-xs font-mono transition-colors cursor-pointer"
        >
          [ ]
        </button>
      </div>

      {/* Floating Hover Tooltip - Informational Only, Never triggers state selection */}
      {tooltip && (
        <div
          className="absolute z-30 pointer-events-none bg-slate-900/90 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg border border-slate-700 backdrop-blur-xs transform -translate-x-1/2 -translate-y-full -mt-2 transition-all duration-75"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-bold text-slate-100">{tooltip.name}</div>
          <div className="text-[11px] text-sky-300 font-medium">
            Projects: <span className="font-bold text-white">{tooltip.count}</span>
          </div>
        </div>
      )}

      {/* Main SVG Render Container with Geographic Projection */}
      <svg
        viewBox={indiaMap.viewBox}
        className="w-full h-full max-w-[480px] max-h-full transition-transform duration-200 ease-out cursor-pointer"
        style={{
          transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: '50% 50%',
          filter: 'drop-shadow(0 4px 12px rgba(0, 75, 135, 0.08))'
        }}
        onMouseLeave={() => {
          setTooltip(null);
          onHoverState(null);
        }}
      >
        <defs>
          <filter id="geo-state-shadow" x="-8%" y="-8%" width="116%" height="116%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#002b5e" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Geographic State Features Group */}
        <g id="geographic-india-states-layer">
          {indiaMap.locations.map((state: { id: string; name: string; path: string }) => {
            const stateId = state.id.toLowerCase();
            const isSelected = selectedStateId.toLowerCase() === stateId;
            const isHovered = hoveredStateId?.toLowerCase() === stateId;
            const data = stateDataMap[stateId];
            const projectCount = data ? data.totalProjects : 24;
            const fillColor = getStateFillColor(stateId, isSelected, isHovered);

            return (
              <g
                key={state.id}
                id={`geo-state-${stateId}`}
                className="transition-all duration-150"
                /* 
                  CRITICAL SELECTION BEHAVIOR:
                  - onClick: ONLY a deliberate click selects the state & triggers parent update
                  - onMouseEnter / onMouseMove: ONLY updates visual highlight and hover tooltip
                */
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectState(stateId);
                }}
                onMouseEnter={(e) => {
                  onHoverState(stateId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const parentRect = e.currentTarget.closest('svg')?.parentElement?.getBoundingClientRect();
                  if (parentRect) {
                    setTooltip({
                      name: data ? data.name : state.name,
                      count: projectCount,
                      x: rect.left + rect.width / 2 - parentRect.left,
                      y: rect.top - parentRect.top
                    });
                  }
                }}
                onMouseMove={(e) => {
                  const parentRect = e.currentTarget.closest('svg')?.parentElement?.getBoundingClientRect();
                  if (parentRect) {
                    setTooltip((prev) =>
                      prev
                        ? {
                            ...prev,
                            x: e.clientX - parentRect.left,
                            y: e.clientY - parentRect.top
                          }
                        : null
                    );
                  }
                }}
                onMouseLeave={() => {
                  onHoverState(null);
                  setTooltip(null);
                }}
              >
                {/* State Geographic Polygon with crisp White Boundary */}
                <path
                  d={state.path}
                  fill={fillColor}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? '2' : '1.2'}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="transition-colors duration-150 hover:brightness-110"
                  style={{
                    filter: isSelected ? 'url(#geo-state-shadow)' : undefined
                  }}
                />

              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Bottom Left Project Density Legend (Inside map container as in reference image) */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-lg p-2 sm:p-2.5 shadow-sm text-[10.5px] sm:text-[11px] text-slate-700 space-y-1 font-medium pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e40af] flex-shrink-0"></span>
          <span>High Density (&gt;100 Projects)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] flex-shrink-0"></span>
          <span>Medium Density (50-100 Projects)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#93c5fd] flex-shrink-0"></span>
          <span>Emerging States (&lt;50 Projects)</span>
        </div>
      </div>
    </div>
  );
};
