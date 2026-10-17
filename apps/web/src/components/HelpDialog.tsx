import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'V', desc: 'Select / Move / Resize / Rotate' },
  { key: 'H / Space', desc: 'Pan / Hand tool' },
  { key: 'R', desc: 'Rectangle shape' },
  { key: 'O', desc: 'Ellipse shape' },
  { key: 'L', desc: 'Line tool' },
  { key: 'A', desc: 'Arrow tool' },
  { key: 'P', desc: 'Freehand pen / drawing' },
  { key: 'T', desc: 'Text box' },
  { key: 'N', desc: 'Sticky note (with Swahili color & author tag)' },
  { key: 'G', desc: 'Toggle background grid' },
  { key: 'Delete / ⌫', desc: 'Delete selected shapes' },
  { key: 'Ctrl/Cmd + D', desc: 'Duplicate selected shapes' },
  { key: 'Ctrl/Cmd + A', desc: 'Select all shapes on board' },
  { key: '[  /  ]', desc: 'Send backward / Bring forward in z-order' },
  { key: 'Arrows', desc: 'Nudge 1px (Shift+Arrow for 10px)' },
  { key: '?', desc: 'Toggle this keyboard shortcuts dialog' },
];

export const HelpDialog: React.FC<HelpDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520,
          maxHeight: '85vh',
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Keyboard size={20} color="#60a5fa" />
            <h3 style={{ fontSize: 17, fontWeight: 600 }}>Keyboard Shortcuts & Gestures</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <span style={{ color: '#cbd5e1' }}>{s.desc}</span>
              <kbd
                style={{
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: '#FDE047',
                  boxShadow: '0 2px 0 #334155',
                }}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
          Mid-range mobile & touch devices: 2-finger drag to pan, pinch to zoom.
        </div>
      </div>
    </div>
  );
};
