import { Point } from '../schema/objects';

/**
 * Smooths raw freehand input points using Chaikin's corner-cutting algorithm.
 * Produces fluid, natural digital ink strokes for pencil and pen drawing.
 */
export function smoothPoints(points: readonly Point[], iterations = 2): Point[] {
  if (points.length <= 2) {
    return [...points];
  }

  let smoothed: Point[] = [...points];

  for (let it = 0; it < iterations; it++) {
    const next: Point[] = [];
    next.push(smoothed[0]); // preserve first point

    for (let i = 0; i < smoothed.length - 1; i++) {
      const p0 = smoothed[i];
      const p1 = smoothed[i + 1];

      // Cut 25% from p0 towards p1
      const q: Point = {
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
        pressure: p0.pressure,
      };

      // Cut 75% from p0 towards p1
      const r: Point = {
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
        pressure: p1.pressure,
      };

      next.push(q);
      next.push(r);
    }

    next.push(smoothed[smoothed.length - 1]); // preserve last point
    smoothed = next;
  }

  return smoothed;
}

/**
 * Creates SVG/Path2D quadratic curve segments through midpoints.
 */
export function buildSmoothPath(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  if (points.length === 0) return;
  if (points.length === 1) {
    ctx.arc(points[0].x, points[0].y, 2, 0, Math.PI * 2);
    return;
  }

  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }

  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }

  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}
