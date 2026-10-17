import React from 'react';
import { useCanvasStore } from '../store/useCanvasStore';

export const PerfOverlay: React.FC = () => {
  const { isDebug, fps, culledCount, totalCount, viewport } = useCanvasStore();

  if (!isDebug) return null;

  const renderedCount = Math.max(0, totalCount - culledCount);
  const fpsColor = fps >= 55 ? '#22c55e' : fps >= 30 ? '#eab308' : '#ef4444';

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        right: 16,
        padding: '10px 14px',
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #334155',
        borderRadius: 10,
        color: '#e2e8f0',
        fontSize: 12,
        fontFamily: 'monospace',
        zIndex: 100,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: '#94a3b8' }}>Render Engine:</span>
        <strong style={{ color: fpsColor, fontSize: 13 }}>{fps} FPS</strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: '#94a3b8' }}>Rendered Objects:</span>
        <span>
          <strong style={{ color: '#60a5fa' }}>{renderedCount}</strong> / {totalCount}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: '#94a3b8' }}>Culled (Offscreen):</span>
        <span style={{ color: '#94a3b8' }}>{culledCount}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: '#94a3b8' }}>Zoom:</span>
        <span>{Math.round(viewport.zoom * 100)}%</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: '#94a3b8' }}>Pan:</span>
        <span>({Math.round(viewport.x)}, {Math.round(viewport.y)})</span>
      </div>
    </div>
  );
};
