const { Server } = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

const wss = new Server({ port: 1234 });
console.log('Yjs WebSocket server listening on ws://localhost:1234');

wss.on('connection', (ws, req) => {
  const docName = req.url?.slice(1) ?? 'default';
  setupWSConnection(ws, req, { docName });
});
