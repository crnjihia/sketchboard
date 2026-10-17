import React from 'react';
import { SWAHILI_PALETTE, SwahiliColor } from '@sketchboard/shared';

interface ColorPickerProps {
  selectedColor: string;
  onSelectColor: (colorName: string) => void;
  onClose?: () => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onSelectColor,
}) => {
  return (
    <div
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 12,
        padding: '12px 14px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
        Rangi za Kiswahili (Palette)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {SWAHILI_PALETTE.map((c: SwahiliColor) => {
          const isSelected = selectedColor.toLowerCase() === c.name.toLowerCase() || selectedColor === c.hex;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => onSelectColor(c.name)}
              title={c.label}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 8,
                backgroundColor: c.hex,
                border: isSelected ? '3px solid #ffffff' : `2px solid ${c.borderHex}`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: c.textHex,
                fontWeight: 700,
                fontSize: 10,
                transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 0 10px rgba(255, 255, 255, 0.4)' : 'none',
              }}
            >
              <span>{c.name.substring(0, 2)}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Color Name Label */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: 8, fontSize: 12, color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
        <span>Selected:</span>
        <strong style={{ color: '#FDE047' }}>
          {SWAHILI_PALETTE.find((c) => c.name.toLowerCase() === selectedColor.toLowerCase() || c.hex === selectedColor)?.label || selectedColor}
        </strong>
      </div>
    </div>
  );
};
