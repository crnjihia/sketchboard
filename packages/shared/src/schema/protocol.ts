import { z } from 'zod';

export const SyncStep1PayloadSchema = z.object({
  boardId: z.string().min(1),
  stateVector: z.instanceof(Uint8Array),
});
export type SyncStep1Payload = z.infer<typeof SyncStep1PayloadSchema>;

export const SyncStep2PayloadSchema = z.object({
  boardId: z.string().min(1),
  update: z.instanceof(Uint8Array),
});
export type SyncStep2Payload = z.infer<typeof SyncStep2PayloadSchema>;

export const SyncUpdatePayloadSchema = z.object({
  boardId: z.string().min(1),
  update: z.instanceof(Uint8Array),
  clientSeq: z.number().int().nonnegative(),
});
export type SyncUpdatePayload = z.infer<typeof SyncUpdatePayloadSchema>;

export const SyncAckPayloadSchema = z.object({
  boardId: z.string().min(1),
  clientSeq: z.number().int().nonnegative(),
  serverTime: z.number().optional(),
});
export type SyncAckPayload = z.infer<typeof SyncAckPayloadSchema>;

export const ViewportStateSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().min(0.05).max(10),
});
export type ViewportState = z.infer<typeof ViewportStateSchema>;

export const CursorMovePayloadSchema = z.object({
  boardId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  viewport: ViewportStateSchema.optional(),
  selectedIds: z.array(z.string()).optional(),
});
export type CursorMovePayload = z.infer<typeof CursorMovePayloadSchema>;

export const RemoteCursorSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  userColor: z.string(),
  x: z.number(),
  y: z.number(),
  viewport: ViewportStateSchema.optional(),
  selectedIds: z.array(z.string()).optional(),
  timestamp: z.number(),
});
export type RemoteCursor = z.infer<typeof RemoteCursorSchema>;

export const PresenceUserSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  userColor: z.string(),
  lastSeen: z.number(),
  activeTool: z.string().optional(),
});
export type PresenceUser = z.infer<typeof PresenceUserSchema>;

export const PresenceListPayloadSchema = z.object({
  boardId: z.string(),
  users: z.array(PresenceUserSchema),
});
export type PresenceListPayload = z.infer<typeof PresenceListPayloadSchema>;

export const JoinBoardPayloadSchema = z.object({
  boardId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
  userColor: z.string().optional(),
  token: z.string().optional(),
});
export type JoinBoardPayload = z.infer<typeof JoinBoardPayloadSchema>;
