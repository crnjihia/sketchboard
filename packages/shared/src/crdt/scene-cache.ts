import * as Y from 'yjs';
import { CanvasObject, safeParseCanvasObject } from '../schema/objects';
import { BoardDocManager } from './board-doc';

export type SceneChangeListener = (cache: SceneCache) => void;

/**
 * Derived plain-JS scene cache updated via Yjs observeDeep.
 * Provides zero-allocation reads during requestAnimationFrame render loops.
 */
export class SceneCache {
  public isDirty: boolean = true;
  private objects: Map<string, CanvasObject> = new Map();
  private sortedObjects: CanvasObject[] = [];
  private readonly manager: BoardDocManager;
  private readonly objectsMap: Y.Map<Y.Map<any>>;
  private readonly zOrderArray: Y.Array<string>;
  private readonly listeners: Set<SceneChangeListener> = new Set();

  private readonly deepObserver = () => {
    this.recompute();
  };

  private readonly zOrderObserver = () => {
    this.recompute();
  };

  constructor(manager: BoardDocManager) {
    this.manager = manager;
    this.objectsMap = this.manager.doc.getMap<Y.Map<any>>('objects');
    this.zOrderArray = this.manager.doc.getArray<string>('zOrder');

    // Attach observers
    this.objectsMap.observeDeep(this.deepObserver);
    this.zOrderArray.observe(this.zOrderObserver);

    // Initial compute
    this.recompute();
  }

  private recompute(): void {
    const newObjects = new Map<string, CanvasObject>();

    for (const [id, innerMap] of this.objectsMap.entries()) {
      const plain: Record<string, any> = {};
      for (const [k, v] of innerMap.entries()) {
        plain[k] = v;
      }
      const parsed = safeParseCanvasObject(plain);
      if (parsed) {
        newObjects.set(id, parsed);
      }
    }

    const zOrder = this.zOrderArray.toArray();
    const newSorted: CanvasObject[] = [];

    for (const id of zOrder) {
      const obj = newObjects.get(id);
      if (obj) {
        newSorted.push(obj);
      }
    }

    // Include any objects missing in zOrder
    for (const [id, obj] of newObjects.entries()) {
      if (!zOrder.includes(id)) {
        newSorted.push(obj);
      }
    }

    this.objects = newObjects;
    this.sortedObjects = newSorted;
    this.isDirty = true;

    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (err) {
        console.error('Error in SceneCache listener:', err);
      }
    }
  }

  public getObjects(): ReadonlyMap<string, CanvasObject> {
    return this.objects;
  }

  public getSortedObjects(): readonly CanvasObject[] {
    return this.sortedObjects;
  }

  public getObject(id: string): CanvasObject | undefined {
    return this.objects.get(id);
  }

  public resetDirty(): void {
    this.isDirty = false;
  }

  public subscribe(listener: SceneChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public destroy(): void {
    this.objectsMap.unobserveDeep(this.deepObserver);
    this.zOrderArray.unobserve(this.zOrderObserver);
    this.listeners.clear();
    this.objects.clear();
    this.sortedObjects = [];
  }
}
