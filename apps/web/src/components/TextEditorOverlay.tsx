import React, { useEffect, useRef, useState } from 'react';
import { BoardDocManager, SceneCache, worldToScreen, StickyObject, TextObject } from '@sketchboard/shared';
import { useCanvasStore } from '../store/useCanvasStore';

interface TextEditorOverlayProps {
  docManager: BoardDocManager;
  sceneCache: SceneCache;
}

export const TextEditorOverlay: React.FC<TextEditorOverlayProps> = ({
  docManager,
  sceneCache,
}) => {
  const { editingId, setEditingId, viewport } = useCanvasStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [val, setVal] = useState('');

  const rawObj = editingId ? sceneCache.getObject(editingId) : null;
  const targetObj: StickyObject | TextObject | null =
    rawObj && (rawObj.type === 'sticky' || rawObj.type === 'text') ? (rawObj as StickyObject | TextObject) : null;

  useEffect(() => {
    if (targetObj) {
      setVal(targetObj.text || '');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 20);
    }
  }, [editingId, targetObj]);

  if (!editingId || !targetObj) return null;

  const screenPos = worldToScreen(targetObj.x, targetObj.y, viewport);
  const isSticky = targetObj.type === 'sticky';
  const width = Math.max(targetObj.w * viewport.zoom, 100);
  const height = Math.max(targetObj.h * viewport.zoom, 40);

  const commitText = () => {
    docManager.updateProperty(editingId, 'text', val, 'local');
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      commitText();
    } else if (e.key === 'Enter' && !e.shiftKey && !isSticky) {
      e.preventDefault();
      commitText();
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: screenPos.x,
        top: screenPos.y,
        width,
        height,
        pointerEvents: 'auto',
        zIndex: 60,
      }}
    >
      <textarea
        ref={textareaRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commitText}
        onKeyDown={handleKeyDown}
        placeholder={isSticky ? 'Type sticky note...' : 'Type text...'}
        style={{
          width: '100%',
          height: '100%',
          border: '1.5px solid #3b82f6',
          borderRadius: isSticky ? 6 : 4,
          padding: isSticky ? 12 : 4,
          background: isSticky ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)',
          color: isSticky ? '#1f2937' : '#f8fafc',
          fontFamily: 'Inter, sans-serif',
          fontSize: `${(targetObj.fontSize || (isSticky ? 16 : 18)) * viewport.zoom}px`,
          lineHeight: 1.35,
          resize: 'none',
          outline: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      />
    </div>
  );
};
