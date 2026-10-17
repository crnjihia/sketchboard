import * as Y from 'yjs';
import {
  CanvasObject,
  CanvasObjectSchema,
  safeParseCanvasObject,
} from '../schema/objects';

/**
 * Manages a Y.Doc corresponding to a single Sketchboard board.
 *
 * Data Model Architecture:
 * - `objects`: Y.Map<string, Y.Map<string, any>>
 *   Keyed by object ID. The value is a nested Y.Map of properties.
 *   This ensures granular, property-level CRDT merges:
 *   e.g. User A dragging x/y while User B alters fill/color will both resolve smoothly.
 * - `zOrder`: Y.Array<string>
 *   Array of object IDs ordered from bottom-most (index 0) to top-most (front).
 */
export class BoardDocManager {
  public readonly doc: Y.Doc;
  public readonly boardId: string;
  private _undoManager?: Y.UndoManager;
  private trackedOrigins?: Set<any>;
  private readonly objectsMap: Y.Map<Y.Map<any>>;
  private readonly zOrderArray: Y.Array<string>;

  constructor(boardId: string, doc?: Y.Doc, trackedOrigins?: Set<any>) {
    this.boardId = boardId;
    this.doc = doc ?? new Y.Doc({ gc: true });
    this.objectsMap = this.doc.getMap<Y.Map<any>>('objects');
    this.zOrderArray = this.doc.getArray<string>('zOrder');
    this.trackedOrigins = trackedOrigins;

    if (trackedOrigins) {
      this._undoManager = new Y.UndoManager([this.objectsMap, this.zOrderArray], {
        trackedOrigins,
      });
    }
  }

  public get undoManager(): Y.UndoManager {
    if (!this._undoManager) {
      this._undoManager = new Y.UndoManager([this.objectsMap, this.zOrderArray], {
        trackedOrigins: this.trackedOrigins ?? new Set(['local']),
      });
    }
    return this._undoManager;
  }

  /**
   * Reverts the last locally tracked operation.
   */
  public undo(): boolean {
    return this.undoManager.undo() !== null;
  }

  /**
   * Re-applies the last undone operation.
   */
  public redo(): boolean {
    return this.undoManager.redo() !== null;
  }

  public canUndo(): boolean {
    return this._undoManager ? this._undoManager.canUndo() : false;
  }

  public canRedo(): boolean {
    return this._undoManager ? this._undoManager.canRedo() : false;
  }

  /**
   * Helper to execute changes inside a transactional boundary with a tracked origin.
   */
  public transact<T>(fn: () => T, origin?: any): T {
    let result: T;
    this.doc.transact(() => {
      result = fn();
    }, origin);
    return result!;
  }

  /**
   * Adds a new canvas object to the board.
   */
  public addObject(obj: CanvasObject, origin?: any): CanvasObject {
    const validated = CanvasObjectSchema.parse(obj);

    this.transact(() => {
      let innerMap = this.objectsMap.get(validated.id);
      if (!innerMap) {
        innerMap = new Y.Map<any>();
        this.objectsMap.set(validated.id, innerMap);
      }

      for (const [key, val] of Object.entries(validated)) {
        innerMap.set(key, val);
      }

      // Add to zOrder if not already present
      const currentZ = this.zOrderArray.toArray();
      if (!currentZ.includes(validated.id)) {
        this.zOrderArray.push([validated.id]);
      }
    }, origin);

    return validated;
  }

  /**
   * Updates an individual property on a shape (property-level CRDT).
   */
  public updateProperty(
    id: string,
    property: string,
    value: any,
    origin?: any
  ): boolean {
    let updated = false;
    this.transact(() => {
      const innerMap = this.objectsMap.get(id);
      if (innerMap) {
        innerMap.set(property, value);
        innerMap.set('updatedAt', Date.now());
        updated = true;
      }
    }, origin);
    return updated;
  }

  /**
   * Updates multiple properties on an object in a single transaction.
   */
  public updateObject(
    id: string,
    updates: Partial<CanvasObject>,
    origin?: any
  ): boolean {
    let updated = false;
    this.transact(() => {
      const innerMap = this.objectsMap.get(id);
      if (innerMap) {
        for (const [key, val] of Object.entries(updates)) {
          if (key === 'id') continue; // ID cannot be mutated
          innerMap.set(key, val);
        }
        innerMap.set('updatedAt', Date.now());
        updated = true;
      }
    }, origin);
    return updated;
  }

  /**
   * Deletes an object by ID from both objects map and zOrder array.
   */
  public deleteObject(id: string, origin?: any): boolean {
    let deleted = false;
    this.transact(() => {
      if (this.objectsMap.has(id)) {
        this.objectsMap.delete(id);
        deleted = true;
      }

      const zArr = this.zOrderArray.toArray();
      const idx = zArr.indexOf(id);
      if (idx !== -1) {
        this.zOrderArray.delete(idx, 1);
      }
    }, origin);
    return deleted;
  }

  /**
   * Brings an object to the front of the zOrder.
   */
  public bringToFront(id: string, origin?: any): void {
    this.transact(() => {
      const zArr = this.zOrderArray.toArray();
      const idx = zArr.indexOf(id);
      if (idx !== -1) {
        this.zOrderArray.delete(idx, 1);
        this.zOrderArray.push([id]);
      }
    }, origin);
  }

  /**
   * Sends an object to the back (index 0) of the zOrder.
   */
  public sendToBack(id: string, origin?: any): void {
    this.transact(() => {
      const zArr = this.zOrderArray.toArray();
      const idx = zArr.indexOf(id);
      if (idx !== -1) {
        this.zOrderArray.delete(idx, 1);
        this.zOrderArray.insert(0, [id]);
      }
    }, origin);
  }

  /**
   * Moves an object up by one layer in z-order.
   */
  public bringForward(id: string, origin?: any): void {
    this.transact(() => {
      const zArr = this.zOrderArray.toArray();
      const idx = zArr.indexOf(id);
      if (idx !== -1 && idx < zArr.length - 1) {
        this.zOrderArray.delete(idx, 1);
        this.zOrderArray.insert(idx + 1, [id]);
      }
    }, origin);
  }

  /**
   * Moves an object down by one layer in z-order.
   */
  public sendBackward(id: string, origin?: any): void {
    this.transact(() => {
      const zArr = this.zOrderArray.toArray();
      const idx = zArr.indexOf(id);
      if (idx > 0) {
        this.zOrderArray.delete(idx, 1);
        this.zOrderArray.insert(idx - 1, [id]);
      }
    }, origin);
  }

  /**
   * Converts a single Y.Map inner object to a validated plain CanvasObject.
   */
  public getObject(id: string): CanvasObject | null {
    const innerMap = this.objectsMap.get(id);
    if (!innerMap) return null;
    const plain: Record<string, any> = {};
    for (const [k, v] of innerMap.entries()) {
      plain[k] = v;
    }
    return safeParseCanvasObject(plain);
  }

  /**
   * Returns a Map of all valid canvas objects keyed by ID.
   */
  public getObjectsMap(): Map<string, CanvasObject> {
    const result = new Map<string, CanvasObject>();
    for (const [id, innerMap] of this.objectsMap.entries()) {
      const plain: Record<string, any> = {};
      for (const [k, v] of innerMap.entries()) {
        plain[k] = v;
      }
      const parsed = safeParseCanvasObject(plain);
      if (parsed) {
        result.set(id, parsed);
      }
    }
    return result;
  }

  /**
   * Returns current zOrder as an array of IDs.
   */
  public getZOrder(): string[] {
    return this.zOrderArray.toArray();
  }

  /**
   * Returns all objects sorted according to zOrder array.
   */
  public getSortedObjects(): CanvasObject[] {
    const objects = this.getObjectsMap();
    const zOrder = this.getZOrder();
    const sorted: CanvasObject[] = [];

    // First collect according to zOrder
    for (const id of zOrder) {
      const obj = objects.get(id);
      if (obj) {
        sorted.push(obj);
        objects.delete(id);
      }
    }

    // Append any orphaned objects (e.g. added before zOrder synced)
    for (const obj of objects.values()) {
      sorted.push(obj);
    }

    return sorted;
  }

  /**
   * Encodes current document state as a full binary snapshot.
   */
  public getSnapshot(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  /**
   * Encodes current document state vector.
   */
  public getStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc);
  }

  /**
   * Computes a diff update containing everything the client is missing based on target vector.
   */
  public diffUpdate(targetStateVector: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc, targetStateVector);
  }

  /**
   * Applies a Yjs binary update to this document.
   */
  public applyUpdate(update: Uint8Array, origin?: any): void {
    Y.applyUpdate(this.doc, update, origin);
  }

  /**
   * Subscribes to document updates, returning an unbind function.
   */
  public onUpdate(callback: (update: Uint8Array, origin: any) => void): () => void {
    const handler = (update: Uint8Array, origin: any) => {
      callback(update, origin);
    };
    this.doc.on('update', handler);
    return () => {
      this.doc.off('update', handler);
    };
  }

  /**
   * Subscribes strictly to local document updates, returning an unbind function.
   */
  public onLocalUpdate(callback: (update: Uint8Array) => void): () => void {
    return this.onUpdate((update, origin) => {
      if (origin === 'local' || origin === undefined) {
        callback(update);
      }
    });
  }

  /**
   * Destroys this manager and cleans up Y.Doc resources.
   */
  public destroy(): void {
    this.doc.destroy();
  }
}

