import React, { useState } from 'react';
import { X, Download, FileImage, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { CanvasObject, SceneCache } from '@sketchboard/shared';
import {
  computeExportBounds,
  renderOffscreenCanvas,
  downloadPNG,
  downloadPDF,
  ExportOptions,
} from '../export/export-engine';

import { useCanvasStore } from '../store/useCanvasStore';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneCache: SceneCache;
  selectedIds: string[];
  boardName: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sceneCache,
  selectedIds,
  boardName,
}) => {
  const { t } = useCanvasStore();
  const [format, setFormat] = useState<'png' | 'pdf'>('png');
  const [scope, setScope] = useState<'all' | 'selection'>('all');
  const [scale, setScale] = useState<1 | 2 | 3>(2);
  const [transparent, setTransparent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  const hasSelection = selectedIds.length > 0;

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      // Yield to UI to show progress spinner
      await new Promise((r) => setTimeout(r, 60));

      const allObjects = sceneCache.getSortedObjects();
      const targetObjects: CanvasObject[] =
        scope === 'selection' && hasSelection
          ? allObjects.filter((o) => selectedIds.includes(o.id))
          : [...allObjects];

      if (targetObjects.length === 0) {
        alert('No shapes found to export.');
        setIsExporting(false);
        return;
      }

      const bounds = computeExportBounds(targetObjects, 32);
      const offscreenCanvas = renderOffscreenCanvas(
        targetObjects,
        bounds,
        scale,
        format === 'png' ? transparent : false
      );

      const sanitizedBoardName = boardName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().substring(0, 10);

      if (format === 'png') {
        const filename = `${sanitizedBoardName}_${timestamp}_@${scale}x.png`;
        await downloadPNG(offscreenCanvas, filename);
      } else {
        const filename = `${sanitizedBoardName}_${timestamp}.pdf`;
        await downloadPDF(offscreenCanvas, boardName, filename);
      }

      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to generate export file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
          width: 480,
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Download size={20} color="#60a5fa" />
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>{t.exportModal.title}</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Format Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{t.exportModal.format}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              onClick={() => setFormat('png')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 14px',
                borderRadius: 10,
                border: format === 'png' ? '2px solid #3b82f6' : '1px solid #334155',
                background: format === 'png' ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                color: format === 'png' ? '#60a5fa' : '#cbd5e1',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <FileImage size={18} /> {t.exportModal.png}
            </button>

            <button
              type="button"
              onClick={() => setFormat('pdf')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 14px',
                borderRadius: 10,
                border: format === 'pdf' ? '2px solid #3b82f6' : '1px solid #334155',
                background: format === 'pdf' ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                color: format === 'pdf' ? '#60a5fa' : '#cbd5e1',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <FileText size={18} /> {t.exportModal.pdf}
            </button>
          </div>
        </div>

        {/* Scope Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{t.exportModal.area}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              onClick={() => setScope('all')}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: scope === 'all' ? '2px solid #3b82f6' : '1px solid #334155',
                background: scope === 'all' ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                color: scope === 'all' ? '#60a5fa' : '#cbd5e1',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t.exportModal.entireBoard}
            </button>

            <button
              type="button"
              onClick={() => setScope('selection')}
              disabled={!hasSelection}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: scope === 'selection' ? '2px solid #3b82f6' : '1px solid #334155',
                background: scope === 'selection' ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                color: !hasSelection ? '#64748b' : scope === 'selection' ? '#60a5fa' : '#cbd5e1',
                fontSize: 13,
                fontWeight: 500,
                cursor: hasSelection ? 'pointer' : 'not-allowed',
                opacity: hasSelection ? 1 : 0.6,
              }}
            >
              {t.exportModal.selectionOnly} ({selectedIds.length})
            </button>
          </div>
        </div>

        {/* Resolution Scale */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{t.exportModal.scale}</label>
            <span style={{ fontSize: 12, color: '#64748b' }}>2x HD retina</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScale(s as 1 | 2 | 3)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: scale === s ? '2px solid #3b82f6' : '1px solid #334155',
                  background: scale === s ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                  color: scale === s ? '#60a5fa' : '#cbd5e1',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {s}x {s === 2 ? '(HD)' : s === 3 ? '(Ultra)' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* PNG Transparent Toggle */}
        {format === 'png' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ fontSize: 13, color: '#cbd5e1' }}>Transparent Background</span>
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#3b82f6' }}
            />
          </div>
        )}

        {/* PDF Nairobi Footer Notice */}
        {format === 'pdf' && (
          <div style={{ fontSize: 12, color: '#64748b', background: '#1e293b', padding: '8px 12px', borderRadius: 8 }}>
            PDF will be fitted to page with a 12mm margin and stamped with Africa/Nairobi timestamp & "Made with Sketchboard".
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          style={{
            marginTop: 8,
            padding: '12px 18px',
            borderRadius: 10,
            border: 'none',
            background: exportSuccess
              ? '#22c55e'
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: 15,
            cursor: isExporting ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            transition: 'all 0.2s ease',
          }}
        >
          {isExporting ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Generating {format.toUpperCase()}...
            </>
          ) : exportSuccess ? (
            <>
              <CheckCircle2 size={18} /> Download Ready!
            </>
          ) : (
            <>
              <Download size={18} /> Export as {format.toUpperCase()}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
