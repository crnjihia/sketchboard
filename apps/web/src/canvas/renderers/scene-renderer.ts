import {
  CanvasObject,
  ViewportState,
  BoundingBox,
  getObjectAABB,
  buildSmoothPath,
  wrapText,
  SWAHILI_COLOR_MAP,
  SwahiliColorName,
} from '@sketchboard/shared';

// Freehand Path2D cache to avoid regenerating paths every frame
const path2dCache = new WeakMap<CanvasObject, Path2D>();

/**
 * Renders all scene objects onto the static scene canvas with viewport culling.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  objects: readonly CanvasObject[],
  viewport: ViewportState,
  visibleBounds: BoundingBox
): { renderedCount: number; culledCount: number } {
  let renderedCount = 0;
  let culledCount = 0;

  ctx.save();
  // Clear scene
  ctx.clearRect(0, 0, width, height);

  // Apply world transformation: translate and scale
  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.zoom, viewport.zoom);

  for (const obj of objects) {
    // Viewport culling
    const aabb = getObjectAABB(obj);
    if (
      aabb.maxX < visibleBounds.minX ||
      aabb.minX > visibleBounds.maxX ||
      aabb.maxY < visibleBounds.minY ||
      aabb.minY > visibleBounds.maxY
    ) {
      culledCount++;
      continue;
    }

    renderedCount++;
    renderSingleObject(ctx, obj);
  }

  ctx.restore();
  return { renderedCount, culledCount };
}

function renderSingleObject(ctx: CanvasRenderingContext2D, obj: CanvasObject): void {
  ctx.save();

  // Apply rotation around shape center
  const rotation = obj.rotation || 0;
  if (rotation !== 0) {
    const cx = obj.x + obj.w / 2;
    const cy = obj.y + obj.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  ctx.globalAlpha = obj.style.opacity ?? 1;
  ctx.lineWidth = obj.style.strokeWidth ?? 2;
  ctx.strokeStyle = obj.style.stroke ?? '#000000';
  ctx.fillStyle = obj.style.fill ?? 'transparent';

  switch (obj.type) {
    case 'rectangle': {
      const radius = obj.cornerRadius ?? 0;
      ctx.beginPath();
      if (radius > 0 && typeof ctx.roundRect === 'function') {
        ctx.roundRect(obj.x, obj.y, obj.w, obj.h, radius);
      } else {
        ctx.rect(obj.x, obj.y, obj.w, obj.h);
      }
      if (obj.style.fill && obj.style.fill !== 'transparent') ctx.fill();
      if (obj.style.strokeWidth > 0) ctx.stroke();
      break;
    }

    case 'ellipse': {
      const rx = Math.abs(obj.w) / 2;
      const ry = Math.abs(obj.h) / 2;
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (obj.style.fill && obj.style.fill !== 'transparent') ctx.fill();
      if (obj.style.strokeWidth > 0) ctx.stroke();
      break;
    }

    case 'line': {
      ctx.beginPath();
      ctx.moveTo(obj.x, obj.y);
      ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
      ctx.stroke();
      break;
    }

    case 'arrow': {
      const x1 = obj.x;
      const y1 = obj.y;
      const x2 = obj.x + obj.w;
      const y2 = obj.y + obj.h;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw arrowhead at (x2, y2)
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headlen = Math.max(12, obj.style.strokeWidth * 3);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headlen * Math.cos(angle - Math.PI / 6),
        y2 - headlen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        x2 - headlen * Math.cos(angle + Math.PI / 6),
        y2 - headlen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = obj.style.stroke;
      ctx.fill();
      break;
    }

    case 'freehand': {
      if (!obj.points || obj.points.length === 0) break;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let cachedPath = path2dCache.get(obj);
      if (!cachedPath) {
        cachedPath = new Path2D();
        buildSmoothPath(cachedPath as any, obj.points);
        path2dCache.set(obj, cachedPath);
      }

      ctx.stroke(cachedPath);
      break;
    }

    case 'text': {
      ctx.font = `${obj.fontSize || 18}px ${obj.fontFamily || 'Inter, sans-serif'}`;
      ctx.fillStyle = obj.style.stroke || '#f8fafc';
      ctx.textBaseline = 'top';

      const lines = wrapText(obj.text || '', Math.max(obj.w, 100), (str) => ctx.measureText(str).width);
      const lineHeight = (obj.fontSize || 18) * 1.3;

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], obj.x, obj.y + i * lineHeight);
      }
      break;
    }

    case 'sticky': {
      // Swahili sticky color palette lookup
      const colorEntry = SWAHILI_COLOR_MAP[obj.color as SwahiliColorName] ?? {
        hex: obj.color || '#FDE047',
        borderHex: '#EAB308',
        textHex: '#713F12',
      };

      // Sticky shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 4;

      // Note background
      ctx.fillStyle = colorEntry.hex;
      ctx.strokeStyle = colorEntry.borderHex;
      ctx.lineWidth = 1;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 6);
      } else {
        ctx.rect(obj.x, obj.y, obj.w, obj.h);
      }
      ctx.fill();
      ctx.stroke();

      // Reset shadow for text
      ctx.shadowColor = 'transparent';

      // Render text inside sticky note
      ctx.fillStyle = colorEntry.textHex;
      ctx.font = `500 ${obj.fontSize || 16}px Inter, sans-serif`;
      ctx.textBaseline = 'top';

      const pad = 14;
      const textWidth = Math.max(obj.w - pad * 2, 20);
      const lines = wrapText(obj.text || '', textWidth, (str) => ctx.measureText(str).width);
      const lineHeight = (obj.fontSize || 16) * 1.35;

      for (let i = 0; i < lines.length; i++) {
        if ((i + 1) * lineHeight > obj.h - pad * 2 - 20) break; // keep room for author tag
        ctx.fillText(lines[i], obj.x + pad, obj.y + pad + i * lineHeight);
      }

      // Author tag in bottom right
      if (obj.authorName) {
        ctx.font = `600 11px Inter, sans-serif`;
        ctx.fillStyle = colorEntry.textHex;
        ctx.globalAlpha = 0.8;
        const authorStr = `— ${obj.authorName}`;
        const authorW = ctx.measureText(authorStr).width;
        ctx.fillText(authorStr, obj.x + obj.w - pad - authorW, obj.y + obj.h - pad - 12);
      }

      break;
    }
  }

  ctx.restore();
}
