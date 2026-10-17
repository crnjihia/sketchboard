import { ViewportState } from '@sketchboard/shared';

/**
 * Renders an infinite canvas dot grid aligned with the world coordinate space.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: ViewportState,
  baseGridSize = 32
): void {
  const zoom = viewport.zoom;
  let step = baseGridSize * zoom;

  // Adaptive grid density: if zoom is small, double the step so dots don't clutter
  while (step < 16) {
    step *= 2;
  }
  while (step > 64) {
    step /= 2;
  }

  // Calculate world origin on screen
  const startX = ((viewport.x % step) + step) % step;
  const startY = ((viewport.y % step) + step) % step;

  ctx.save();
  ctx.fillStyle = '#334155'; // Slate 700 dot color

  const dotRadius = Math.max(1, 1.2 * Math.min(zoom, 1.5));

  for (let x = startX; x < width; x += step) {
    for (let y = startY; y < height; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
