import { z } from 'zod';

export const ObjectStyleSchema = z.object({
  fill: z.string().default('transparent'),
  stroke: z.string().default('#000000'),
  strokeWidth: z.number().min(0).default(2),
  opacity: z.number().min(0).max(1).default(1),
});

export type ObjectStyle = z.infer<typeof ObjectStyleSchema>;

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
  pressure: z.number().min(0).max(1).optional(),
});

export type Point = z.infer<typeof PointSchema>;

const BaseObjectSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  rotation: z.number().default(0),
  z: z.number().default(0),
  style: ObjectStyleSchema,
  createdBy: z.string(),
  updatedAt: z.number(),
});

export const RectangleObjectSchema = BaseObjectSchema.extend({
  type: z.literal('rectangle'),
  cornerRadius: z.number().min(0).optional(),
});

export const EllipseObjectSchema = BaseObjectSchema.extend({
  type: z.literal('ellipse'),
});

export const LineObjectSchema = BaseObjectSchema.extend({
  type: z.literal('line'),
});

export const ArrowObjectSchema = BaseObjectSchema.extend({
  type: z.literal('arrow'),
});

export const FreehandObjectSchema = BaseObjectSchema.extend({
  type: z.literal('freehand'),
  points: z.array(PointSchema).default([]),
});

export const TextObjectSchema = BaseObjectSchema.extend({
  type: z.literal('text'),
  text: z.string().default(''),
  fontSize: z.number().min(8).max(144).default(18),
  fontFamily: z.string().default('Inter, sans-serif'),
  align: z.enum(['left', 'center', 'right']).default('left'),
});

export const StickyObjectSchema = BaseObjectSchema.extend({
  type: z.literal('sticky'),
  text: z.string().default(''),
  authorName: z.string().default('Anonymous'),
  color: z.string().default('Njano'),
  fontSize: z.number().min(8).max(72).default(16),
});

export const CanvasObjectSchema = z.discriminatedUnion('type', [
  RectangleObjectSchema,
  EllipseObjectSchema,
  LineObjectSchema,
  ArrowObjectSchema,
  FreehandObjectSchema,
  TextObjectSchema,
  StickyObjectSchema,
]);

export type RectangleObject = z.infer<typeof RectangleObjectSchema>;
export type EllipseObject = z.infer<typeof EllipseObjectSchema>;
export type LineObject = z.infer<typeof LineObjectSchema>;
export type ArrowObject = z.infer<typeof ArrowObjectSchema>;
export type FreehandObject = z.infer<typeof FreehandObjectSchema>;
export type TextObject = z.infer<typeof TextObjectSchema>;
export type StickyObject = z.infer<typeof StickyObjectSchema>;

export type CanvasObject = z.infer<typeof CanvasObjectSchema>;
export type CanvasObjectType = CanvasObject['type'];

/**
 * Validates a candidate plain object as a CanvasObject.
 * Throws ZodError on validation failure.
 */
export function validateCanvasObject(data: unknown): CanvasObject {
  return CanvasObjectSchema.parse(data);
}

/**
 * Safely parses data into CanvasObject or returns null on failure.
 */
export function safeParseCanvasObject(data: unknown): CanvasObject | null {
  const result = CanvasObjectSchema.safeParse(data);
  return result.success ? result.data : null;
}
