import {
  CanvasObject,
  BoundingBox,
  getObjectAABB,
  buildSmoothPath,
  wrapText,
  SWAHILI_COLOR_MAP,
  SwahiliColorName,
} from '@sketchboard/shared';
import { jsPDF } from 'jspdf';

export interface ExportOptions {
  format: 'png' | 'pdf';
  scope: 'all' | 'selection';
  scale: 1 | 2 | 3;
  transparent: boolean;
  boardName: string;
}

/**
 * Calculates the bounding box that encompasses all given objects plus padding.
 */
export function computeExportBounds(
  objects: readonly CanvasObject[],
  padding = 32
): BoundingBox {
  if (objects.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, w: 800, h: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    const aabb = getObjectAABB(obj);
    if (aabb.minX < minX) minX = aabb.minX;
    if (aabb.minY < minY) minY = aabb.minY;
    if (aabb.maxX > maxX) maxX = aabb.maxX;
    if (aabb.maxY > maxY) maxY = aabb.maxY;
  }

  const w = maxX - minX + padding * 2;
  const h = maxY - minY + padding * 2;

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
    w: Math.max(w, 100),
    h: Math.max(h, 100),
  };
}

/**
 * Renders shapes onto an offscreen Canvas at 1x, 2x, or 3x scale.
 * Independent of current viewport pan and zoom.
 */
export function renderOffscreenCanvas(
  objects: readonly CanvasObject[],
  bounds: BoundingBox,
  scale: 1 | 2 | 3 = 2,
  transparent = false
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bounds.w * scale);
  canvas.height = Math.round(bounds.h * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(scale, scale);

  // Background
  if (!transparent) {
    ctx.fillStyle = '#090d16'; // Sketchboard sleek dark background
    ctx.fillRect(0, 0, bounds.w, bounds.h);
  }

  // Translate world coordinates relative to bounding box
  ctx.translate(-bounds.minX, -bounds.minY);

  for (const obj of objects) {
    ctx.save();

    // Rotate around center
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
        ctx.beginPath();
        buildSmoothPath(ctx, obj.points);
        ctx.stroke();
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
        const colorEntry = SWAHILI_COLOR_MAP[obj.color as SwahiliColorName] ?? {
          hex: obj.color || '#FDE047',
          borderHex: '#EAB308',
          textHex: '#713F12',
        };

        // Sticky shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 4;

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

        ctx.shadowColor = 'transparent';

        // Sticky text
        ctx.fillStyle = colorEntry.textHex;
        ctx.font = `500 ${obj.fontSize || 16}px Inter, sans-serif`;
        ctx.textBaseline = 'top';

        const pad = 14;
        const textWidth = Math.max(obj.w - pad * 2, 20);
        const lines = wrapText(obj.text || '', textWidth, (str) => ctx.measureText(str).width);
        const lineHeight = (obj.fontSize || 16) * 1.35;

        for (let i = 0; i < lines.length; i++) {
          if ((i + 1) * lineHeight > obj.h - pad * 2 - 20) break;
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

  return canvas;
}

/**
 * Downloads a Blob via browser link click.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports canvas to PNG blob file.
 */
export async function downloadPNG(
  canvas: HTMLCanvasElement,
  filename = 'sketchboard.png'
): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, filename);
      }
      resolve();
    }, 'image/png');
  });
}

/**
 * Formats current time in Africa/Nairobi timezone (EAT).
 */
export function formatNairobiTimestamp(date = new Date()): string {
  return new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Exports canvas to a formatted PDF with margins and Nairobi footer.
 */
export async function downloadPDF(
  canvas: HTMLCanvasElement,
  boardName: string,
  filename = 'sketchboard.pdf'
): Promise<void> {
  const imgData = canvas.toDataURL('image/png');
  const isLandscape = canvas.width >= canvas.height;
  const orientation = isLandscape ? 'landscape' : 'portrait';

  // Choose A4 or A3 based on canvas resolution
  const format = Math.max(canvas.width, canvas.height) > 2400 ? 'a3' : 'a4';

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 12; // 12mm margin
  const footerHeight = 12; // 12mm reserved for footer

  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2 - footerHeight;

  // Fit image maintaining aspect ratio
  const imgAspect = canvas.width / canvas.height;
  let renderW = printableWidth;
  let renderH = printableWidth / imgAspect;

  if (renderH > printableHeight) {
    renderH = printableHeight;
    renderW = printableHeight * imgAspect;
  }

  const posX = margin + (printableWidth - renderW) / 2;
  const posY = margin + (printableHeight - renderH) / 2;

  // Add the canvas image
  doc.addImage(imgData, 'PNG', posX, posY, renderW, renderH, undefined, 'FAST');

  // Add Nairobi-time stamped footer
  const nairobiTime = formatNairobiTimestamp();
  const footerY = pageHeight - 8;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);

  doc.text(`Board: ${boardName}`, margin, footerY);
  doc.text(`${nairobiTime} (EAT)`, pageWidth / 2, footerY, { align: 'center' });
  doc.text('Made with Sketchboard', pageWidth - margin, footerY, { align: 'right' });

  doc.save(filename);
}
