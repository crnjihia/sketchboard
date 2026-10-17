import {
  CanvasObject,
  ViewportState,
  BoundingBox,
  getObjectHandles,
  worldToScreen,
  RemoteCursor,
} from '@sketchboard/shared';

export interface OverlayRenderProps {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  viewport: ViewportState;
  selectedObjects: readonly CanvasObject[];
  marquee: BoundingBox | null;
  previewObject: Partial<CanvasObject> | null;
  remoteCursors: readonly RemoteCursor[];
}

/**
 * Renders selection handles, marquee selection, creation previews, and remote cursors.
 * Renders on a separate canvas layer to avoid invalidating the static scene canvas during cursor movement.
 */
export function renderOverlay({
  ctx,
  width,
  height,
  viewport,
  selectedObjects,
  marquee,
  previewObject,
  remoteCursors,
}: OverlayRenderProps): void {
  ctx.clearRect(0, 0, width, height);

  // 1. Draw Marquee Selection
  if (marquee) {
    const s1 = worldToScreen(marquee.minX, marquee.minY, viewport);
    const s2 = worldToScreen(marquee.maxX, marquee.maxY, viewport);
    const mw = s2.x - s1.x;
    const mh = s2.y - s1.y;

    ctx.save();
    ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.fillRect(s1.x, s1.y, mw, mh);
    ctx.strokeRect(s1.x, s1.y, mw, mh);
    ctx.restore();
  }

  // 2. Draw Selection Bounds & Handles for Selected Objects
  for (const obj of selectedObjects) {
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Apply object rotation
    const rotation = obj.rotation || 0;
    const cx = obj.x + obj.w / 2;
    const cy = obj.y + obj.h / 2;
    if (rotation !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    // Selection border
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / viewport.zoom;
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);

    // Draw handles in unrotated local coords then restore
    ctx.restore();

    // Now render handles with fixed screen size (8px x 8px)
    const handles = getObjectHandles(obj, 24 / viewport.zoom);
    for (const h of handles) {
      const screenPos = worldToScreen(h.x, h.y, viewport);

      ctx.save();
      if (h.type === 'rot') {
        // Rotation handle: circle
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Connect line from top-center to rot handle
        const topMid = handles.find((item) => item.type === 'n');
        if (topMid) {
          const topScreen = worldToScreen(topMid.x, topMid.y, viewport);
          ctx.beginPath();
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1;
          ctx.moveTo(topScreen.x, topScreen.y);
          ctx.lineTo(screenPos.x, screenPos.y);
          ctx.stroke();
        }
      } else {
        // Resize handle: square
        const size = 8;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.fillRect(screenPos.x - size / 2, screenPos.y - size / 2, size, size);
        ctx.strokeRect(screenPos.x - size / 2, screenPos.y - size / 2, size, size);
      }
      ctx.restore();
    }
  }

  // 3. Draw In-Progress Creation Preview
  if (previewObject && previewObject.type) {
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);
    ctx.strokeStyle = previewObject.style?.stroke || '#3b82f6';
    ctx.fillStyle = previewObject.style?.fill || 'transparent';
    ctx.lineWidth = previewObject.style?.strokeWidth || 2;
    ctx.setLineDash([4, 4]);

    const px = previewObject.x || 0;
    const py = previewObject.y || 0;
    const pw = previewObject.w || 0;
    const ph = previewObject.h || 0;

    if (previewObject.type === 'rectangle' || previewObject.type === 'sticky') {
      ctx.strokeRect(px, py, pw, ph);
    } else if (previewObject.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(px + pw / 2, py + ph / 2, Math.abs(pw) / 2, Math.abs(ph) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (previewObject.type === 'line' || previewObject.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + pw, py + ph);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4. Draw Remote Live Cursors
  const now = Date.now();
  for (const cursor of remoteCursors) {
    // Fade out after 5s idle
    const age = now - cursor.timestamp;
    if (age > 5000) continue;
    const opacity = Math.max(0, 1 - age / 5000);

    const s = worldToScreen(cursor.x, cursor.y, viewport);

    ctx.save();
    ctx.globalAlpha = opacity;

    // Arrow glyph in participant color
    ctx.fillStyle = cursor.userColor || '#60A5FA';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x, s.y + 16);
    ctx.lineTo(s.x + 4.5, s.y + 12);
    ctx.lineTo(s.x + 12, s.y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Name label chip
    const name = cursor.userName || 'Anonymous';
    ctx.font = '600 11px Inter, sans-serif';
    const textW = ctx.measureText(name).width;
    const chipW = textW + 12;
    const chipH = 20;
    const chipX = s.x + 10;
    const chipY = s.y + 14;

    ctx.fillStyle = cursor.userColor || '#60A5FA';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(chipX, chipY, chipW, chipH, 4);
    } else {
      ctx.rect(chipX, chipY, chipW, chipH);
    }
    ctx.fill();

    // Text on chip
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, chipX + 6, chipY + chipH / 2);

    ctx.restore();
  }
}
