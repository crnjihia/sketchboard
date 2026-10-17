import React, { useState } from 'react';
import {
  MousePointer,
  Hand,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Pencil,
  Type,
  StickyNote,
  Grid,
  ZoomIn,
  ZoomOut,
  Palette,
} from 'lucide-react';
import { useCanvasStore, ToolType } from '../store/useCanvasStore';
import { ColorPicker } from './ColorPicker';
import { SWAHILI_COLOR_MAP, SwahiliColorName } from '@sketchboard/shared';

interface ToolItem {
  id: ToolType;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}

export const Toolbar: React.FC = () => {
  const {
    tool,
    setTool,
    activeColor,
    setActiveColor,
    gridEnabled,
    toggleGrid,
    viewport,
    setViewport,
    t,
  } = useCanvasStore();

  const [showColorPicker, setShowColorPicker] = useState(false);

  const TOOLS: ToolItem[] = [
    { id: 'select', label: t.toolbar.select, shortcut: 'V', icon: <MousePointer size={18} /> },
    { id: 'hand', label: t.toolbar.hand, shortcut: 'H', icon: <Hand size={18} /> },
    { id: 'rectangle', label: t.toolbar.rectangle, shortcut: 'R', icon: <Square size={18} /> },
    { id: 'ellipse', label: t.toolbar.ellipse, shortcut: 'O', icon: <Circle size={18} /> },
    { id: 'line', label: t.toolbar.line, shortcut: 'L', icon: <Minus size={18} /> },
    { id: 'arrow', label: t.toolbar.arrow, shortcut: 'A', icon: <ArrowUpRight size={18} /> },
    { id: 'freehand', label: t.toolbar.pen, shortcut: 'P', icon: <Pencil size={18} /> },
    { id: 'text', label: t.toolbar.text, shortcut: 'T', icon: <Type size={18} /> },
    { id: 'sticky', label: t.toolbar.sticky, shortcut: 'N', icon: <StickyNote size={18} /> },
  ];

  const currentColorEntry = SWAHILI_COLOR_MAP[activeColor as SwahiliColorName] ?? {
    hex: activeColor,
    label: activeColor,
    borderHex: '#3b82f6',
  };

  const handleZoom = (delta: number) => {
    setViewport((prev) => ({
      ...prev,
      zoom: Math.min(4.0, Math.max(0.1, prev.zoom + delta)),
    }));
  };

  const resetZoom = () => {
    setViewport((prev) => ({ ...prev, zoom: 1 }));
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(51, 65, 85, 0.7)',
        borderRadius: 16,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        zIndex: 50,
      }}
    >
      {/* Primary Tool Buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        {TOOLS.map((t) => {
          const isActive = tool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              data-tool={t.id}
              data-testid={`tool-${t.id}`}
              title={t.label}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: 'none',
                background: isActive ? '#3b82f6' : 'transparent',
                color: isActive ? '#ffffff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t.icon}
            </button>
          );
        })}
      </div>

      <div style={{ width: 1, height: 24, background: '#334155', margin: '0 4px' }} />

      {/* Swahili Color Picker Popover Button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          title={`Swahili Colour: ${currentColorEntry.label}`}
          style={{
            height: 36,
            padding: '0 8px',
            borderRadius: 8,
            border: `1.5px solid ${currentColorEntry.borderHex || '#475569'}`,
            background: 'rgba(30, 41, 59, 0.7)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: currentColorEntry.hex,
              display: 'inline-block',
            }}
          />
          <Palette size={14} color="#94a3b8" />
        </button>

        {showColorPicker && (
          <div style={{ position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
            <ColorPicker
              selectedColor={activeColor}
              onSelectColor={(colorName) => {
                setActiveColor(colorName);
                setShowColorPicker(false);
              }}
            />
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 24, background: '#334155', margin: '0 4px' }} />

      {/* Grid Toggle */}
      <button
        onClick={toggleGrid}
        title={t.toolbar.grid}
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          border: 'none',
          background: gridEnabled ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
          color: gridEnabled ? '#60a5fa' : '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Grid size={18} />
      </button>

      {/* Zoom Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingLeft: 4 }}>
        <button
          onClick={() => handleZoom(-0.15)}
          title={t.toolbar.zoomOut}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ZoomOut size={15} />
        </button>

        <button
          onClick={resetZoom}
          title={t.toolbar.resetZoom}
          style={{
            height: 24,
            padding: '0 6px',
            borderRadius: 4,
            border: 'none',
            background: 'rgba(51, 65, 85, 0.5)',
            color: '#cbd5e1',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {Math.round(viewport.zoom * 100)}%
        </button>

        <button
          onClick={() => handleZoom(0.15)}
          title={t.toolbar.zoomIn}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ZoomIn size={15} />
        </button>
      </div>
    </div>
  );
};
