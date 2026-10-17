import { CanvasObject, Point } from '../schema/objects';
import { getObjectAABB, BoundingBox } from './transforms';
import { hitTestObject } from './hit-test';

/**
 * High-performance Uniform Spatial Grid index for 60fps viewport culling and fast hit-testing.
 */
export class SpatialGrid {
  private readonly cellSize: number;
  private readonly grid: Map<string, Set<string>> = new Map();
  private readonly objects: Map<string, CanvasObject> = new Map();
  private readonly objectCells: Map<string, Set<string>> = new Map();

  constructor(cellSize = 256) {
    this.cellSize = cellSize;
  }

  private getCellKey(col: number, row: number): string {
    return `${col}:${row}`;
  }

  private getGridRange(aabb: BoundingBox): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
    return {
      minCol: Math.floor(aabb.minX / this.cellSize),
      maxCol: Math.floor(aabb.maxX / this.cellSize),
      minRow: Math.floor(aabb.minY / this.cellSize),
      maxRow: Math.floor(aabb.maxY / this.cellSize),
    };
  }

  public insert(obj: CanvasObject): void {
    this.objects.set(obj.id, obj);
    const aabb = getObjectAABB(obj);
    const range = this.getGridRange(aabb);
    const cells = new Set<string>();

    for (let col = range.minCol; col <= range.maxCol; col++) {
      for (let row = range.minRow; row <= range.maxRow; row++) {
        const key = this.getCellKey(col, row);
        cells.add(key);

        let cellSet = this.grid.get(key);
        if (!cellSet) {
          cellSet = new Set();
          this.grid.set(key, cellSet);
        }
        cellSet.add(obj.id);
      }
    }

    this.objectCells.set(obj.id, cells);
  }

  public remove(id: string): void {
    this.objects.delete(id);
    const cells = this.objectCells.get(id);
    if (!cells) return;

    for (const key of cells) {
      const cellSet = this.grid.get(key);
      if (cellSet) {
        cellSet.delete(id);
        if (cellSet.size === 0) {
          this.grid.delete(key);
        }
      }
    }

    this.objectCells.delete(id);
  }

  public update(obj: CanvasObject): void {
    this.remove(obj.id);
    this.insert(obj);
  }

  public clear(): void {
    this.grid.clear();
    this.objects.clear();
    this.objectCells.clear();
  }

  public bulkLoad(objects: readonly CanvasObject[]): void {
    this.clear();
    for (const obj of objects) {
      this.insert(obj);
    }
  }

  /**
   * Queries all candidate objects whose cells intersect the visible viewport.
   * Viewport culling drops off-screen shapes before rendering.
   */
  public queryViewport(viewportAABB: BoundingBox): CanvasObject[] {
    const range = this.getGridRange(viewportAABB);
    const candidateIds = new Set<string>();

    for (let col = range.minCol; col <= range.maxCol; col++) {
      for (let row = range.minRow; row <= range.maxRow; row++) {
        const key = this.getCellKey(col, row);
        const cellSet = this.grid.get(key);
        if (cellSet) {
          for (const id of cellSet) {
            candidateIds.add(id);
          }
        }
      }
    }

    const results: CanvasObject[] = [];
    for (const id of candidateIds) {
      const obj = this.objects.get(id);
      if (obj) {
        // Fine-grained AABB check against viewport
        const aabb = getObjectAABB(obj);
        if (
          !(
            aabb.maxX < viewportAABB.minX ||
            aabb.minX > viewportAABB.maxX ||
            aabb.maxY < viewportAABB.minY ||
            aabb.minY > viewportAABB.maxY
          )
        ) {
          results.push(obj);
        }
      }
    }

    return results;
  }

  /**
   * Fast broad-phase + narrow-phase hit test for a point.
   */
  public hitTest(p: Point, hitMargin = 6): CanvasObject | null {
    const col = Math.floor(p.x / this.cellSize);
    const row = Math.floor(p.y / this.cellSize);
    const key = this.getCellKey(col, row);
    const cellSet = this.grid.get(key);

    if (!cellSet || cellSet.size === 0) return null;

    // Check shapes in cell
    for (const id of cellSet) {
      const obj = this.objects.get(id);
      if (obj && hitTestObject(p, obj, hitMargin)) {
        return obj;
      }
    }

    return null;
  }
}
