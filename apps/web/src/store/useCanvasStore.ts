import { create } from 'zustand';
import { ViewportState } from '@sketchboard/shared';
import { Locale, Translations, translations } from '../i18n';

export type ToolType =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'text'
  | 'sticky';

export interface CanvasState {
  // Tool & selection
  tool: ToolType;
  selectedIds: string[];
  hoveredId: string | null;
  activeColor: string; // Swahili color name or hex
  activeStrokeColor: string;
  activeStrokeWidth: number;

  // Viewport
  viewport: ViewportState;
  gridEnabled: boolean;

  // In-progress text editing
  editingId: string | null;

  // Performance HUD
  isDebug: boolean;
  fps: number;
  culledCount: number;
  totalCount: number;

  // i18n
  locale: Locale;
  t: Translations;

  // Actions
  setTool: (tool: ToolType) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectId: (id: string) => void;
  clearSelection: () => void;
  setHoveredId: (id: string | null) => void;
  setActiveColor: (color: string) => void;
  setActiveStrokeColor: (color: string) => void;
  setActiveStrokeWidth: (width: number) => void;
  setViewport: (viewport: Partial<ViewportState> | ((prev: ViewportState) => ViewportState)) => void;
  toggleGrid: () => void;
  setEditingId: (id: string | null) => void;
  setPerfMetrics: (metrics: { fps: number; culledCount: number; totalCount: number }) => void;
  setLocale: (locale: Locale) => void;
}

const checkDebugFlag = () => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
};

export const useCanvasStore = create<CanvasState>((set) => ({
  tool: 'select',
  selectedIds: [],
  hoveredId: null,
  activeColor: 'Njano',
  activeStrokeColor: '#1e293b',
  activeStrokeWidth: 2,

  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
  gridEnabled: true,

  editingId: null,

  isDebug: checkDebugFlag(),
  fps: 60,
  culledCount: 0,
  totalCount: 0,

  locale: 'en',
  t: translations['en'],

  setTool: (tool) => set({ tool, selectedIds: tool === 'select' ? undefined : [] }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  toggleSelectId: (id) =>
    set((state) => {
      const exists = state.selectedIds.includes(id);
      return {
        selectedIds: exists
          ? state.selectedIds.filter((item) => item !== id)
          : [...state.selectedIds, id],
      };
    }),
  clearSelection: () => set({ selectedIds: [] }),
  setHoveredId: (hoveredId) => set({ hoveredId }),
  setActiveColor: (activeColor) => set({ activeColor }),
  setActiveStrokeColor: (activeStrokeColor) => set({ activeStrokeColor }),
  setActiveStrokeWidth: (activeStrokeWidth) => set({ activeStrokeWidth }),
  setViewport: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.viewport) : { ...state.viewport, ...updater };
      // Clamp zoom between 10% (0.1) and 400% (4.0)
      const clampedZoom = Math.min(4.0, Math.max(0.1, next.zoom));
      return { viewport: { ...next, zoom: clampedZoom } };
    }),
  toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
  setEditingId: (editingId) => set({ editingId }),
  setPerfMetrics: (metrics) => set(metrics),
  setLocale: (locale) => set({ locale, t: translations[locale] }),
}));

