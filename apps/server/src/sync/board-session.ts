import { BoardDocManager } from '@sketchboard/shared';

interface SocketRateTracker {
  count: number;
  resetAt: number;
}

/**
 * Manages in-memory Yjs board sessions and client rate limits.
 */
export class BoardSessionManager {
  private sessions = new Map<string, BoardDocManager>();
  private rateTrackers = new Map<string, SocketRateTracker>();
  private socketBoards = new Map<string, string>(); // socketId -> boardId

  /**
   * Retrieves or initializes an in-memory BoardDocManager for the given boardId.
   */
  public getOrCreateSession(boardId: string): BoardDocManager {
    let session = this.sessions.get(boardId);
    if (!session) {
      session = new BoardDocManager(boardId);
      this.sessions.set(boardId, session);
    }
    return session;
  }

  /**
   * Checks if an incoming socket has exceeded its update rate limit.
   */
  public checkRateLimit(socketId: string, limitPerSec: number): boolean {
    const now = Date.now();
    let tracker = this.rateTrackers.get(socketId);

    if (!tracker || now > tracker.resetAt) {
      tracker = { count: 1, resetAt: now + 1000 };
      this.rateTrackers.set(socketId, tracker);
      return true;
    }

    if (tracker.count >= limitPerSec) {
      return false; // Rate limit exceeded
    }

    tracker.count++;
    return true;
  }

  /**
   * Registers a socket with a board.
   */
  public registerSocket(socketId: string, boardId: string): void {
    this.socketBoards.set(socketId, boardId);
  }

  /**
   * Cleans up socket tracking on disconnect.
   */
  public cleanupSocket(socketId: string): string | undefined {
    this.rateTrackers.delete(socketId);
    const boardId = this.socketBoards.get(socketId);
    this.socketBoards.delete(socketId);
    return boardId;
  }

  /**
   * Cleans up all resources.
   */
  public destroy(): void {
    for (const session of this.sessions.values()) {
      session.destroy();
    }
    this.sessions.clear();
    this.rateTrackers.clear();
    this.socketBoards.clear();
  }
}
