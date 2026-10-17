import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  BoardDocManager,
  SceneCache,
  Point,
  RemoteCursor,
  getDeterministicUserColor,
} from '@sketchboard/shared';
import { CanvasContainer } from './components/CanvasContainer';
import { ExportModal } from './components/ExportModal';
import { useCanvasStore } from './store/useCanvasStore';
import { Users, Download } from 'lucide-react';

interface OutboxItem {
  clientSeq: number;
  update: Uint8Array;
}

export const App: React.FC = () => {
  // Parse boardId from query param ?board= or URL path /b/:boardId, defaulting to 'nairobi-hq'
  const boardId = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryBoard = searchParams.get('board');
    if (queryBoard) return queryBoard;
    const match = window.location.pathname.match(/\/b\/([^/]+)/);
    return match ? match[1] : 'nairobi-hq';
  }, []);

  const [connected, setConnected] = useState(false);
  const [nodeId, setNodeId] = useState<string>('unknown');
  const [savingStatus, setSavingStatus] = useState<string>('Saved');
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const { selectedIds, locale, setLocale, t } = useCanvasStore();

  // User identity
  const [userId] = useState(() => 'usr_' + Math.random().toString(36).substring(2, 9));
  const [userName] = useState(() => {
    const names = ['Amina Kimani', 'Juma Ochieng', 'Zainab Wanjiru', 'David Kiprop', 'Faith Muthoni'];
    return names[Math.floor(Math.random() * names.length)];
  });
  const userColor = useMemo(() => getDeterministicUserColor(userId), [userId]);

  // CRDT Document and Scene Cache singletons (with user-scoped UndoManager)
  const docManager = useMemo(() => new BoardDocManager(boardId, undefined, new Set(['local'])), [boardId]);
  const sceneCache = useMemo(() => new SceneCache(docManager), [docManager]);

  // Expose for Playwright E2E assertions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__SKETCHBOARD__ = {
        docManager,
        sceneCache,
        userId,
        userName,
        userColor,
      };
    }
  }, [docManager, sceneCache, userColor, userId, userName]);

  // Outbox for reliable optimistic updates
  const outboxRef = useRef<Map<number, OutboxItem>>(new Map());
  const seqCounterRef = useRef<number>(1);
  const socketRef = useRef<Socket | null>(null);

  // Setup Socket.io and Yjs sync loop
  useEffect(() => {
    const socket: Socket = io({
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setSavingStatus('Saved');

      // Join board room
      socket.emit('join:board', {
        boardId,
        userId,
        userName,
        userColor: userColor.hex,
      });

      // Flush any pending outbox items on reconnect
      for (const item of outboxRef.current.values()) {
        socket.emit('sync:update', {
          boardId,
          update: item.update,
          clientSeq: item.clientSeq,
        });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      const pending = outboxRef.current.size;
      setSavingStatus(pending > 0 ? `Offline (${pending} pending)` : 'Offline');
    });

    socket.on('sync:init', (data: { snapshot: ArrayBuffer; nodeId?: string; participantCount?: number }) => {
      if (data.nodeId) setNodeId(data.nodeId);
      if (data.participantCount !== undefined) setParticipantCount(data.participantCount);
      docManager.applyUpdate(new Uint8Array(data.snapshot));
    });

    socket.on('sync:update', (data: { update: ArrayBuffer }) => {
      docManager.applyUpdate(new Uint8Array(data.update));
    });

    socket.on('sync:ack', (ack: { clientSeq: number }) => {
      outboxRef.current.delete(ack.clientSeq);
      if (outboxRef.current.size === 0) {
        setSavingStatus('Saved');
      } else {
        setSavingStatus(`Saving… (${outboxRef.current.size})`);
      }
    });

    // Remote volatile cursors
    socket.on('cursor:move', (remote: RemoteCursor) => {
      setRemoteCursors((prev) => {
        const filtered = prev.filter((c) => c.userId !== remote.userId);
        return [...filtered, remote];
      });
    });

    socket.on('presence:join', () => {
      setParticipantCount((prev) => prev + 1);
    });

    socket.on('presence:leave', (data: { userId: string }) => {
      setParticipantCount((prev) => Math.max(1, prev - 1));
      setRemoteCursors((prev) => prev.filter((c) => c.userId !== data.userId));
    });

    // Track local document mutations to dispatch to socket
    const onDocUpdate = (update: Uint8Array, origin: any) => {
      if (origin === 'local') {
        const seq = seqCounterRef.current++;
        outboxRef.current.set(seq, { clientSeq: seq, update });
        setSavingStatus('Saving…');

        if (socket.connected) {
          socket.emit('sync:update', {
            boardId,
            update,
            clientSeq: seq,
          });
        }
      }
    };

    docManager.doc.on('update', onDocUpdate);

    return () => {
      docManager.doc.off('update', onDocUpdate);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [boardId, docManager, userColor.hex, userId, userName]);

  // Throttled cursor emission (30fps ~33ms)
  const lastCursorEmitRef = useRef<number>(0);
  const handleEmitCursor = useCallback(
    (worldPos: Point) => {
      const now = performance.now();
      if (now - lastCursorEmitRef.current < 33) return; // Cap at ~30 msgs/sec
      lastCursorEmitRef.current = now;

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('cursor:move', {
          boardId,
          x: Math.round(worldPos.x),
          y: Math.round(worldPos.y),
        });
      }
    },
    [boardId]
  );

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#090d16', color: '#f3f4f6', overflow: 'hidden' }}>
      {/* Top Header Bar */}
      <header
        style={{
          height: 50,
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(8px)',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #FDE047 0%, #FB923C 50%, #F87171 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#090d16',
              fontSize: 15,
              boxShadow: '0 2px 8px rgba(251, 146, 60, 0.3)',
            }}
          >
            S
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: -0.3 }}>Sketchboard</span>
          <span style={{ fontSize: 12, color: '#94a3b8', background: '#1e293b', padding: '3px 8px', borderRadius: 6, border: '1px solid #334155' }}>
            /b/{boardId}
          </span>
        </div>

        {/* Sync Status, Node Info & Participants */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          {/* Connection & Save Status */}
          <div data-testid="connection-status" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: connected ? '#22c55e' : '#ef4444',
                boxShadow: connected ? '0 0 8px #22c55e' : 'none',
              }}
            />
            <span style={{ color: connected ? '#94a3b8' : '#f87171' }}>
              {connected ? `${savingStatus} (${nodeId})` : savingStatus}
            </span>
          </div>

          {/* Active Participants */}
          <div data-testid="participant-badge" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', padding: '3px 10px', borderRadius: 20, border: '1px solid #334155' }}>
            <Users size={14} color="#60a5fa" />
            <span data-testid="participant-count" style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{participantCount}</span>
          </div>

          {/* Language Switcher (EN / SW) */}
          <div style={{ display: 'flex', background: '#1e293b', borderRadius: 8, border: '1px solid #334155', overflow: 'hidden' }}>
            <button
              onClick={() => setLocale('en')}
              data-testid="lang-en"
              title="English"
              style={{
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: locale === 'en' ? '#3b82f6' : 'transparent',
                color: locale === 'en' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s ease',
              }}
            >
              EN
            </button>
            <button
              onClick={() => setLocale('sw')}
              data-testid="lang-sw"
              title="Kiswahili"
              style={{
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: locale === 'sw' ? '#3b82f6' : 'transparent',
                color: locale === 'sw' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s ease',
              }}
            >
              SW
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={() => setIsExportOpen(true)}
            data-testid="export-button"
            title="Export PNG or PDF (Ctrl+E)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.15s ease',
            }}
          >
            <Download size={14} />
            <span>{t.header.export}</span>
          </button>

          {/* Current User Chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid #334155', paddingLeft: 14 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                backgroundColor: userColor.hex,
                color: userColor.textHex,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
                boxShadow: `0 0 6px ${userColor.hex}88`,
              }}
            >
              {userName.substring(0, 1)}
            </span>
            <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{userName}</span>
          </div>
        </div>
      </header>

      {/* Offline Reconnect Banner */}
      {!connected && (
        <div
          style={{
            background: '#b91c1c',
            color: '#fef2f2',
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 2px 8px rgba(185, 28, 28, 0.4)',
            zIndex: 35,
          }}
        >
          <span>⚠️ {t.toast.offlineWarning}</span>
        </div>
      )}

      {/* Main Dual-Layer Canvas Container */}
      <main style={{ flex: 1, position: 'relative' }}>
        <CanvasContainer
          docManager={docManager}
          sceneCache={sceneCache}
          onEmitCursor={handleEmitCursor}
          remoteCursors={remoteCursors}
          userName={userName}
        />
      </main>

      {/* Export Options Modal (PNG / PDF) */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        sceneCache={sceneCache}
        selectedIds={selectedIds}
        boardName={boardId}
      />
    </div>
  );
};

export default App;
