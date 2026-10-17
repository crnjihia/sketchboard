import React, { useEffect, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { SWAHILI_PALETTE, BoardDocManager, getDeterministicUserColor } from '@sketchboard/shared';

export const App: React.FC = () => {
  // Parse boardId from URL path /b/:boardId or default to 'nairobi-hq'
  const boardId = useMemo(() => {
    const match = window.location.pathname.match(/\/b\/([^/]+)/);
    return match ? match[1] : 'nairobi-hq';
  }, []);

  const [connected, setConnected] = useState(false);
  const [nodeId, setNodeId] = useState<string>('unknown');
  const [savingStatus, setSavingStatus] = useState<'Saved' | 'Saving…' | 'Offline'>('Saved');
  const [userId] = useState(() => 'usr_' + Math.random().toString(36).substring(2, 9));
  const [userName] = useState(() => 'Designer ' + Math.floor(Math.random() * 100));
  const userColor = useMemo(() => getDeterministicUserColor(userId), [userId]);

  const [docManager] = useState(() => new BoardDocManager(boardId));
  const [objectCount, setObjectCount] = useState(0);

  useEffect(() => {
    const socket: Socket = io({
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      setConnected(true);
      setSavingStatus('Saved');
      socket.emit('join:board', {
        boardId,
        userId,
        userName,
        userColor: userColor.hex,
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setSavingStatus('Offline');
    });

    socket.on('sync:init', (data: { snapshot: ArrayBuffer; nodeId?: string }) => {
      if (data.nodeId) setNodeId(data.nodeId);
      docManager.applyUpdate(new Uint8Array(data.snapshot));
      setObjectCount(docManager.getObjectsMap().size);
    });

    socket.on('sync:update', (data: { update: ArrayBuffer }) => {
      docManager.applyUpdate(new Uint8Array(data.update));
      setObjectCount(docManager.getObjectsMap().size);
    });

    return () => {
      socket.disconnect();
    };
  }, [boardId, docManager, userColor.hex, userId, userName]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#090d16', color: '#f3f4f6' }}>
      {/* Top Bar */}
      <header style={{
        height: 52,
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: '#0f172a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #FDE047 0%, #FB923C 50%, #F87171 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: '#1e1e1e',
            fontSize: 14
          }}>
            S
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: -0.3 }}>Sketchboard</span>
          <span style={{ fontSize: 13, color: '#64748b', background: '#1e293b', padding: '2px 8px', borderRadius: 4 }}>
            Board: {boardId}
          </span>
        </div>

        {/* Sync & Server Node Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: connected ? '#22c55e' : '#ef4444',
              boxShadow: connected ? '0 0 8px #22c55e' : 'none'
            }} />
            <span style={{ color: connected ? '#94a3b8' : '#f87171' }}>
              {connected ? `${savingStatus} (Node: ${nodeId})` : 'Offline'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid #334155', paddingLeft: 16 }}>
            <span style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: userColor.hex,
              color: userColor.textHex,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 11
            }}>
              {userName.substring(0, 1)}
            </span>
            <span style={{ color: '#cbd5e1' }}>{userName}</span>
          </div>
        </div>
      </header>

      {/* Main Body placeholder for Phase 1 verification */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#f8fafc' }}>
          Sketchboard Engine Initialized (Phase 1)
        </h2>
        <p style={{ color: '#94a3b8', maxWidth: 480, textAlign: 'center', fontSize: 14 }}>
          Yjs CRDT property-level document model is active with real-time Socket.io binary sync.
          Objects currently loaded on board: <strong style={{ color: '#FDE047' }}>{objectCount}</strong>
        </p>

        {/* Swahili Palette Showcase */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b' }}>
            Swahili Colour Palette
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {SWAHILI_PALETTE.map((color) => (
              <div
                key={color.name}
                title={color.label}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: color.hex,
                  border: `2px solid ${color.borderHex}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: color.textHex,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {color.name.substring(0, 2)}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
