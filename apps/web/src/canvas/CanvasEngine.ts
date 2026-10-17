import {
  BoardDocManager,
  SceneCache,
  SpatialGrid,
  CanvasObject,
  Point,
  ViewportState,
  BoundingBox,
  screenToWorld,
  hitTestHandles,
  hitTestObject,
  getObjectHandles,
  getObjectAABB,
  smoothPoints,
  RemoteCursor,
  HandleType,
  intersectsMarquee,
} from '@sketchboard/shared';
import { renderScene } from './renderers/scene-renderer';
import { renderOverlay } from './renderers/overlay-renderer';
import { renderGrid } from './renderers/grid-renderer';
import { ToolType } from '../store/useCanvasStore';

export interface CanvasEngineOptions {
  sceneCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  container: HTMLElement;
  docManager: BoardDocManager;
  sceneCache: SceneCache;
  onSelect: (ids: string[]) => void;
  onEdit: (id: string | null) => void;
  onCursorMove: (worldPos: Point) => void;
  onPerfUpdate?: (metrics: { fps: number; culledCount: number; totalCount: number }) => void;
}

type InteractionMode =
  | 'idle'
  | 'panning'
  | 'dragging'
  | 'resizing'
  | 'rotating'
  | 'marquee'
  | 'creating'
  | 'drawing';

export class CanvasEngine {
  private readonly sceneCanvas: HTMLCanvasElement;
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private readonly sceneCtx: CanvasRenderingContext2D;
  private readonly overlayCtx: CanvasRenderingContext2D;
  private readonly docManager: BoardDocManager;
  private readonly sceneCache: SceneCache;
  private readonly spatialGrid: SpatialGrid = new SpatialGrid(256);

  private readonly onSelect: (ids: string[]) => void;
  private readonly onEdit: (id: string | null) => void;
  private readonly onCursorMove: (worldPos: Point) => void;
  private readonly onPerfUpdate?: (metrics: { fps: number; culledCount: number; totalCount: number }) => void;

  public viewport: ViewportState = { x: 0, y: 0, zoom: 1 };
  public gridEnabled: boolean = true;
  public currentTool: ToolType = 'select';
  public selectedIds: string[] = [];
  public activeColor: string = 'Njano';
  public activeStrokeColor: string = '#000000';
  public activeStrokeWidth: number = 2;
  public userName: string = 'User';

  private remoteCursors: RemoteCursor[] = [];
  private isRunning: boolean = false;
  private rafId: number = 0;
  private dpr: number = 1;

  // Interaction State
  private mode: InteractionMode = 'idle';
  private startPointerWorld: Point = { x: 0, y: 0 };
  private startPointerScreen: Point = { x: 0, y: 0 };
  private lastPointerScreen: Point = { x: 0, y: 0 };
  private activeHandle: HandleType | null = null;
  private activeTargetId: string | null = null;
  private initialObjectSnapshots: Map<string, CanvasObject> = new Map();
  private marqueeBox: BoundingBox | null = null;
  private previewObject: Partial<CanvasObject> | null = null;
  private rawFreehandPoints: Point[] = [];
  private isSpacePressed: boolean = false;

  // Multi-touch tracking
  private activePointers = new Map<number, { x: number; y: number }>();
  private initialPinchDist: number = 0;
  private initialPinchZoom: number = 1;

  // Performance tracking
  private frameCount = 0;
  private lastFpsTimestamp = performance.now();
  private currentFps = 60;

  constructor(options: CanvasEngineOptions) {
    this.sceneCanvas = options.sceneCanvas;
    this.overlayCanvas = options.overlayCanvas;
    this.container = options.container;
    this.docManager = options.docManager;
    this.sceneCache = options.sceneCache;
    this.onSelect = options.onSelect;
    this.onEdit = options.onEdit;
    this.onCursorMove = options.onCursorMove;
    this.onPerfUpdate = options.onPerfUpdate;

    this.sceneCtx = this.sceneCanvas.getContext('2d')!;
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;

    this.initSpatialGrid();
    this.bindEvents();
    this.handleResize();
    this.startLoop();
  }

  private initSpatialGrid(): void {
    const sorted = this.sceneCache.getSortedObjects();
    this.spatialGrid.bulkLoad(sorted);

    this.sceneCache.subscribe((cache) => {
      this.spatialGrid.bulkLoad(cache.getSortedObjects());
    });
  }

  public setRemoteCursors(cursors: RemoteCursor[]): void {
    this.remoteCursors = cursors;
  }

  public setViewport(newViewport: ViewportState): void {
    this.viewport = newViewport;
    this.sceneCache.isDirty = true;
  }

  public setSelectedIds(ids: string[]): void {
    this.selectedIds = ids;
  }

  public handleResize = (): void => {
    this.dpr = window.devicePixelRatio || 1;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.sceneCanvas.width = width * this.dpr;
    this.sceneCanvas.height = height * this.dpr;
    this.sceneCanvas.style.width = `${width}px`;
    this.sceneCanvas.style.height = `${height}px`;

    this.overlayCanvas.width = width * this.dpr;
    this.overlayCanvas.height = height * this.dpr;
    this.overlayCanvas.style.width = `${width}px`;
    this.overlayCanvas.style.height = `${height}px`;

    this.sceneCtx.scale(this.dpr, this.dpr);
    this.overlayCtx.scale(this.dpr, this.dpr);

    this.sceneCache.isDirty = true;
  };

  private startLoop(): void {
    this.isRunning = true;
    const loop = (timestamp: number) => {
      if (!this.isRunning) return;

      // FPS tracking
      this.frameCount++;
      if (timestamp - this.lastFpsTimestamp >= 500) {
        this.currentFps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsTimestamp));
        this.frameCount = 0;
        this.lastFpsTimestamp = timestamp;
      }

      const width = this.container.clientWidth;
      const height = this.container.clientHeight;

      // 1. Static Scene Canvas: Repaint ONLY when dirty
      if (this.sceneCache.isDirty) {
        const visibleWorldBounds: BoundingBox = {
          minX: -this.viewport.x / this.viewport.zoom - 50,
          minY: -this.viewport.y / this.viewport.zoom - 50,
          maxX: (width - this.viewport.x) / this.viewport.zoom + 50,
          maxY: (height - this.viewport.y) / this.viewport.zoom + 50,
          w: width / this.viewport.zoom + 100,
          h: height / this.viewport.zoom + 100,
        };

        const sorted = this.sceneCache.getSortedObjects();
        const { renderedCount, culledCount } = renderScene(
          this.sceneCtx,
          width,
          height,
          sorted,
          this.viewport,
          visibleWorldBounds
        );

        // Draw grid if enabled
        if (this.gridEnabled) {
          renderGrid(this.sceneCtx, width, height, this.viewport);
        }

        this.sceneCache.resetDirty();

        if (this.onPerfUpdate) {
          this.onPerfUpdate({
            fps: this.currentFps,
            culledCount,
            totalCount: sorted.length,
          });
        }
      }

      // 2. Interaction & Overlay Canvas: Render handles, marquee, cursors
      const selectedObjects = this.selectedIds
        .map((id) => this.sceneCache.getObject(id))
        .filter((o): o is CanvasObject => o !== undefined);

      renderOverlay({
        ctx: this.overlayCtx,
        width,
        height,
        viewport: this.viewport,
        selectedObjects,
        marquee: this.marqueeBox,
        previewObject: this.previewObject,
        remoteCursors: this.remoteCursors,
      });

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  // --- Pointer & Touch Pipeline ---

  private bindEvents(): void {
    const el = this.overlayCanvas;

    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.handleResize);
  }

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.overlayCanvas.setPointerCapture(e.pointerId);

    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Handle 2-finger touch pinch zoom
    if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      this.initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.initialPinchZoom = this.viewport.zoom;
      this.mode = 'panning';
      return;
    }

    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPt = screenToWorld(screenX, screenY, this.viewport);

    this.startPointerScreen = { x: screenX, y: screenY };
    this.lastPointerScreen = { x: screenX, y: screenY };
    this.startPointerWorld = worldPt;

    // Pan with space bar or middle mouse button
    if (this.isSpacePressed || e.button === 1 || this.currentTool === 'hand') {
      this.mode = 'panning';
      return;
    }

    // 1. Check if clicking on resize or rotate handle of selected object
    if (this.selectedIds.length === 1) {
      const selectedObj = this.sceneCache.getObject(this.selectedIds[0]);
      if (selectedObj) {
        const handle = hitTestHandles(worldPt, selectedObj, this.viewport.zoom);
        if (handle) {
          this.activeHandle = handle;
          this.activeTargetId = selectedObj.id;
          this.initialObjectSnapshots.set(selectedObj.id, { ...selectedObj });
          this.mode = handle === 'rot' ? 'rotating' : 'resizing';
          return;
        }
      }
    }

    // 2. Select Tool: hit-test shapes
    if (this.currentTool === 'select') {
      const allObjects = this.sceneCache.getSortedObjects();
      let hit: CanvasObject | null = null;

      // Top to bottom hit test
      for (let i = allObjects.length - 1; i >= 0; i--) {
        if (hitTestObject(worldPt, allObjects[i])) {
          hit = allObjects[i];
          break;
        }
      }

      if (hit) {
        if (e.shiftKey) {
          const newIds = this.selectedIds.includes(hit.id)
            ? this.selectedIds.filter((id) => id !== hit.id)
            : [...this.selectedIds, hit.id];
          this.selectedIds = newIds;
          this.onSelect(newIds);
        } else if (!this.selectedIds.includes(hit.id)) {
          this.selectedIds = [hit.id];
          this.onSelect([hit.id]);
        }

        // Prepare for dragging
        this.mode = 'dragging';
        this.initialObjectSnapshots.clear();
        for (const id of this.selectedIds) {
          const obj = this.sceneCache.getObject(id);
          if (obj) this.initialObjectSnapshots.set(id, { ...obj });
        }
      } else {
        // Clicked on empty canvas -> Marquee selection
        if (!e.shiftKey) {
          this.selectedIds = [];
          this.onSelect([]);
        }
        this.mode = 'marquee';
        this.marqueeBox = { minX: worldPt.x, minY: worldPt.y, maxX: worldPt.x, maxY: worldPt.y, w: 0, h: 0 };
      }
      return;
    }

    // 3. Freehand Pen Tool
    if (this.currentTool === 'freehand') {
      this.mode = 'drawing';
      this.rawFreehandPoints = [{ x: worldPt.x, y: worldPt.y, pressure: e.pressure || 0.5 }];
      this.previewObject = {
        type: 'freehand',
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        style: {
          stroke: this.activeStrokeColor,
          strokeWidth: this.activeStrokeWidth,
          fill: 'transparent',
          opacity: 1,
        },
        points: this.rawFreehandPoints,
      };
      return;
    }

    // 4. Shape creation tools (rectangle, ellipse, line, arrow, sticky, text)
    if (this.currentTool === 'text' || this.currentTool === 'sticky') {
      this.createDirectShape(this.currentTool, worldPt);
      return;
    }

    // Drag-to-create rectangle, ellipse, line, arrow
    this.mode = 'creating';
    this.previewObject = {
      type: this.currentTool as any,
      x: worldPt.x,
      y: worldPt.y,
      w: 0,
      h: 0,
      style: {
        fill: this.currentTool === 'rectangle' || this.currentTool === 'ellipse' ? this.activeColor : 'transparent',
        stroke: this.activeStrokeColor,
        strokeWidth: this.activeStrokeWidth,
        opacity: 1,
      },
    };
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch pinch zoom
    if (this.activePointers.size === 2 && this.mode === 'panning') {
      const pts = Array.from(this.activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.initialPinchDist > 0) {
        const factor = dist / this.initialPinchDist;
        const newZoom = Math.min(4.0, Math.max(0.1, this.initialPinchZoom * factor));
        this.viewport.zoom = newZoom;
        this.sceneCache.isDirty = true;
      }
      return;
    }

    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPt = screenToWorld(screenX, screenY, this.viewport);

    // Broadcast cursor position
    this.onCursorMove(worldPt);

    const dxScreen = screenX - this.lastPointerScreen.x;
    const dyScreen = screenY - this.lastPointerScreen.y;
    this.lastPointerScreen = { x: screenX, y: screenY };

    if (this.mode === 'panning') {
      this.viewport.x += dxScreen;
      this.viewport.y += dyScreen;
      this.sceneCache.isDirty = true;
      return;
    }

    if (this.mode === 'dragging') {
      const totalDxWorld = worldPt.x - this.startPointerWorld.x;
      const totalDyWorld = worldPt.y - this.startPointerWorld.y;

      for (const [id, initial] of this.initialObjectSnapshots) {
        this.docManager.updateObject(
          id,
          {
            x: Math.round(initial.x + totalDxWorld),
            y: Math.round(initial.y + totalDyWorld),
          },
          'local'
        );
      }
      return;
    }

    if (this.mode === 'resizing' && this.activeTargetId && this.activeHandle) {
      const initial = this.initialObjectSnapshots.get(this.activeTargetId);
      if (initial) {
        const updated = this.calculateResize(initial, this.activeHandle, worldPt);
        this.docManager.updateObject(this.activeTargetId, updated, 'local');
      }
      return;
    }

    if (this.mode === 'rotating' && this.activeTargetId) {
      const initial = this.initialObjectSnapshots.get(this.activeTargetId);
      if (initial) {
        const cx = initial.x + initial.w / 2;
        const cy = initial.y + initial.h / 2;
        const rad = Math.atan2(worldPt.y - cy, worldPt.x - cx);
        const deg = (rad * 180) / Math.PI + 90;
        this.docManager.updateProperty(this.activeTargetId, 'rotation', Math.round(deg), 'local');
      }
      return;
    }

    if (this.mode === 'marquee' && this.marqueeBox) {
      this.marqueeBox = {
        minX: Math.min(this.startPointerWorld.x, worldPt.x),
        minY: Math.min(this.startPointerWorld.y, worldPt.y),
        maxX: Math.max(this.startPointerWorld.x, worldPt.x),
        maxY: Math.max(this.startPointerWorld.y, worldPt.y),
        w: Math.abs(worldPt.x - this.startPointerWorld.x),
        h: Math.abs(worldPt.y - this.startPointerWorld.y),
      };

      // Query spatial grid for objects in marquee
      const candidates = this.spatialGrid.queryViewport(this.marqueeBox);
      const matchedIds = candidates
        .filter((o) => intersectsMarquee(o, this.marqueeBox!))
        .map((o) => o.id);

      this.selectedIds = matchedIds;
      this.onSelect(matchedIds);
      return;
    }

    if (this.mode === 'creating' && this.previewObject) {
      this.previewObject.x = Math.min(this.startPointerWorld.x, worldPt.x);
      this.previewObject.y = Math.min(this.startPointerWorld.y, worldPt.y);
      this.previewObject.w = Math.abs(worldPt.x - this.startPointerWorld.x);
      this.previewObject.h = Math.abs(worldPt.y - this.startPointerWorld.y);
      return;
    }

    if (this.mode === 'drawing') {
      this.rawFreehandPoints.push({ x: worldPt.x, y: worldPt.y, pressure: e.pressure || 0.5 });
      if (this.previewObject) {
        (this.previewObject as any).points = this.rawFreehandPoints;
      }
      return;
    }

    // Hover cursor feedback when idle
    if (this.mode === 'idle') {
      this.updateCursorFeedback(worldPt);
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);

    if (this.mode === 'creating' && this.previewObject) {
      const minSize = 5;
      if ((this.previewObject.w || 0) > minSize || (this.previewObject.h || 0) > minSize) {
        const id = 'shape_' + Math.random().toString(36).substring(2, 9);
        const newObj: CanvasObject = {
          id,
          type: this.previewObject.type as any,
          x: Math.round(this.previewObject.x || 0),
          y: Math.round(this.previewObject.y || 0),
          w: Math.round(this.previewObject.w || 100),
          h: Math.round(this.previewObject.h || 100),
          rotation: 0,
          z: this.sceneCache.getSortedObjects().length + 1,
          style: {
            fill: this.previewObject.style?.fill || 'transparent',
            stroke: this.activeStrokeColor,
            strokeWidth: this.activeStrokeWidth,
            opacity: 1,
          },
          createdBy: this.userName,
          updatedAt: Date.now(),
        };

        this.docManager.addObject(newObj, 'local');
        this.selectedIds = [id];
        this.onSelect([id]);
      }
      this.previewObject = null;
    }

    if (this.mode === 'drawing' && this.rawFreehandPoints.length > 1) {
      const id = 'stroke_' + Math.random().toString(36).substring(2, 9);
      const smoothed = smoothPoints(this.rawFreehandPoints, 2);

      const aabb = getObjectAABB({
        id,
        type: 'freehand',
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        rotation: 0,
        z: 1,
        style: { fill: 'transparent', stroke: this.activeStrokeColor, strokeWidth: this.activeStrokeWidth, opacity: 1 },
        points: smoothed,
        createdBy: this.userName,
        updatedAt: Date.now(),
      });

      const newObj: CanvasObject = {
        id,
        type: 'freehand',
        x: Math.round(aabb.minX),
        y: Math.round(aabb.minY),
        w: Math.round(aabb.w),
        h: Math.round(aabb.h),
        rotation: 0,
        z: this.sceneCache.getSortedObjects().length + 1,
        style: {
          fill: 'transparent',
          stroke: this.activeStrokeColor,
          strokeWidth: this.activeStrokeWidth,
          opacity: 1,
        },
        points: smoothed,
        createdBy: this.userName,
        updatedAt: Date.now(),
      };

      this.docManager.addObject(newObj, 'local');
      this.previewObject = null;
      this.rawFreehandPoints = [];
    }

    this.mode = 'idle';
    this.marqueeBox = null;
    this.activeHandle = null;
    this.activeTargetId = null;
    this.initialObjectSnapshots.clear();
  };

  private createDirectShape(type: 'text' | 'sticky', worldPt: Point): void {
    const id = 'shape_' + Math.random().toString(36).substring(2, 9);
    const z = this.sceneCache.getSortedObjects().length + 1;

    if (type === 'sticky') {
      const sticky: CanvasObject = {
        id,
        type: 'sticky',
        x: Math.round(worldPt.x - 100),
        y: Math.round(worldPt.y - 100),
        w: 200,
        h: 200,
        rotation: 0,
        z,
        style: {
          fill: this.activeColor,
          stroke: '#EAB308',
          strokeWidth: 1,
          opacity: 1,
        },
        text: '',
        authorName: this.userName,
        color: this.activeColor,
        fontSize: 16,
        createdBy: this.userName,
        updatedAt: Date.now(),
      };

      this.docManager.addObject(sticky, 'local');
      this.selectedIds = [id];
      this.onSelect([id]);
      this.onEdit(id);
    } else {
      const textObj: CanvasObject = {
        id,
        type: 'text',
        x: Math.round(worldPt.x),
        y: Math.round(worldPt.y),
        w: 180,
        h: 40,
        rotation: 0,
        z,
        style: {
          fill: 'transparent',
          stroke: this.activeStrokeColor || '#f8fafc',
          strokeWidth: 0,
          opacity: 1,
        },
        text: '',
        fontSize: 18,
        fontFamily: 'Inter, sans-serif',
        align: 'left',
        createdBy: this.userName,
        updatedAt: Date.now(),
      };

      this.docManager.addObject(textObj, 'local');
      this.selectedIds = [id];
      this.onSelect([id]);
      this.onEdit(id);
    }
  }

  private calculateResize(
    initial: CanvasObject,
    handle: HandleType,
    currentPt: Point
  ): Partial<CanvasObject> {
    let { x, y, w, h } = initial;

    if (handle.includes('e')) w = currentPt.x - initial.x;
    if (handle.includes('s')) h = currentPt.y - initial.y;
    if (handle.includes('w')) {
      w = initial.x + initial.w - currentPt.x;
      x = currentPt.x;
    }
    if (handle.includes('n')) {
      h = initial.y + initial.h - currentPt.y;
      y = currentPt.y;
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(Math.max(w, 10)),
      h: Math.round(Math.max(h, 10)),
    };
  }

  private updateCursorFeedback(worldPt: Point): void {
    if (this.selectedIds.length === 1) {
      const obj = this.sceneCache.getObject(this.selectedIds[0]);
      if (obj) {
        const handle = hitTestHandles(worldPt, obj, this.viewport.zoom);
        if (handle) {
          const handles = getObjectHandles(obj, 24 / this.viewport.zoom);
          const found = handles.find((h) => h.type === handle);
          if (found) {
            this.overlayCanvas.style.cursor = found.cursor;
            return;
          }
        }
      }
    }

    if (this.currentTool === 'hand' || this.isSpacePressed) {
      this.overlayCanvas.style.cursor = 'grab';
    } else if (this.currentTool === 'select') {
      const hit = this.spatialGrid.hitTest(worldPt);
      this.overlayCanvas.style.cursor = hit ? 'move' : 'default';
    } else if (this.currentTool === 'freehand') {
      this.overlayCanvas.style.cursor = 'crosshair';
    } else {
      this.overlayCanvas.style.cursor = 'crosshair';
    }
  }

  // Zoom to cursor
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      // Pinch to zoom or ctrl+wheel
      const zoomFactor = 1 - e.deltaY * 0.005;
      const newZoom = Math.min(4.0, Math.max(0.1, this.viewport.zoom * zoomFactor));

      const worldX = (mouseX - this.viewport.x) / this.viewport.zoom;
      const worldY = (mouseY - this.viewport.y) / this.viewport.zoom;

      this.viewport.x = mouseX - worldX * newZoom;
      this.viewport.y = mouseY - worldY * newZoom;
      this.viewport.zoom = newZoom;
    } else {
      // Two finger pan or wheel scroll
      this.viewport.x -= e.deltaX;
      this.viewport.y -= e.deltaY;
    }

    this.sceneCache.isDirty = true;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && !this.isSpacePressed) {
      this.isSpacePressed = true;
      this.overlayCanvas.style.cursor = 'grab';
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      this.isSpacePressed = false;
      this.overlayCanvas.style.cursor = 'default';
    }
  };

  public destroy(): void {
    this.isRunning = false;
    cancelAnimationFrame(this.rafId);

    const el = this.overlayCanvas;
    el.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    el.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.handleResize);
  }
}
