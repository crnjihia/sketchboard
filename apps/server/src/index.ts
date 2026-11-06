// path: apps/server/src/index.ts
import http from 'http';
import { Server } from 'socket.io';
import {
  MpesaStkPushRequestSchema,
  AfricaTalkingSmsRequestSchema,
  parseMpesaCallback,
  isValidKenyanPhone,
} from '@sketchboard/shared';
import { config } from './config';
import { BoardSessionManager } from './sync/board-session';
import { setupSocketHandlers } from './sync/socket-handler';
import { redisService } from './sync/redis-adapter';
import { storage } from './persistence/storage';
import { paymentLedger } from './persistence/payment-ledger';
import { metrics } from './sync/metrics';
import { getMpesaClient } from './integrations/mpesa';
import {
  getAfricaTalkingClient,
  MockAfricaTalkingClient,
} from './integrations/africastalking';

function parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 64) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function createSketchboardServer() {
  const sessionManager = new BoardSessionManager();
  let io: Server;

  const server = http.createServer(async (req, res) => {
    // Enable CORS for all incoming HTTP requests
    res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '/';
    const method = req.method;

    // 1. Healthcheck & Readiness Endpoints
    if ((url === '/health' || url === '/healthz' || url === '/readyz') && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          nodeId: config.nodeId,
          activeBoards: metrics.activeBoards,
          uptime: process.uptime(),
          mpesaMock: config.mpesaMock,
          africasTalkingMock: config.africasTalkingMock,
        })
      );
      return;
    }

    // 2. Room Participant Count Endpoint
    if (url.startsWith('/api/rooms/') && url.endsWith('/participants') && method === 'GET') {
      const parts = url.split('/');
      const boardId = parts[3];
      const count = io?.sockets.adapter.rooms.get(boardId)?.size ?? 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          boardId,
          participants: count,
        })
      );
      return;
    }

    // 3. Prometheus Metrics Endpoint
    if (url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      res.end(metrics.getMetricsAsPrometheusText());
      return;
    }

    // 4. M-Pesa STK Push Initiation Endpoint
    if (url === '/api/payments/mpesa/stkpush' && method === 'POST') {
      try {
        const body = await parseJsonBody<unknown>(req);
        const validated = MpesaStkPushRequestSchema.parse(body);
        const mpesaClient = getMpesaClient();
        const response = await mpesaClient.initiateStkPush(validated);

        // Record pending transaction in persistence ledger
        await paymentLedger.createPendingTransaction({
          merchantRequestId: response.MerchantRequestID,
          checkoutRequestId: response.CheckoutRequestID,
          boardId: validated.boardId,
          userId: validated.userId,
          phoneNumber: validated.phone,
          amountKes: validated.amount,
          planType: validated.planType,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err: any) {
        const statusCode = err?.name === 'ZodError' ? 400 : 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: err?.message || 'Failed to initiate M-Pesa STK Push',
            issues: err?.issues,
          })
        );
      }
      return;
    }

    // 5. M-Pesa Safaricom Daraja Webhook Callback Endpoint
    if (url === '/api/payments/mpesa/callback' && method === 'POST') {
      try {
        const body = await parseJsonBody<unknown>(req);
        const callbackResult = parseMpesaCallback(body);

        // Reconcile and persist in database ledger
        const updatedTx = await paymentLedger.applyCallbackResult(callbackResult);

        if (callbackResult.success && updatedTx) {
          // 1. Dispatch SMS confirmation receipt via Africa's Talking gateway
          try {
            const atClient = getAfricaTalkingClient();
            await atClient.sendPaymentReceipt({
              recipientPhone: updatedTx.phoneNumber,
              amountKes: updatedTx.amount,
              planName: updatedTx.planType,
              mpesaReceipt: callbackResult.mpesaReceiptNumber || 'NLX000000',
            });
          } catch (smsErr) {
            console.warn('[M-Pesa Callback] Failed to dispatch SMS receipt:', smsErr);
          }

          // 2. Broadcast real-time Socket.io notification to the board room
          if (io) {
            io.to(updatedTx.boardId).emit('payment:confirmed', {
              boardId: updatedTx.boardId,
              planType: updatedTx.planType,
              amountKes: updatedTx.amount,
              mpesaReceipt: callbackResult.mpesaReceiptNumber,
              timestamp: callbackResult.transactionDate,
            });
          }
        } else if (updatedTx && io) {
          io.to(updatedTx.boardId).emit('payment:failed', {
            boardId: updatedTx.boardId,
            checkoutRequestId: callbackResult.checkoutRequestId,
            resultCode: callbackResult.resultCode,
            reason: callbackResult.resultDesc,
          });
        }

        // Safaricom Daraja specification requires this JSON acknowledgement
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ResultCode: 1,
            ResultDesc: err?.message || 'Invalid callback payload',
          })
        );
      }
      return;
    }

    // 6. M-Pesa STK Push Status Query Endpoint
    if (url.startsWith('/api/payments/mpesa/status/') && method === 'GET') {
      try {
        const checkoutRequestId = url.replace('/api/payments/mpesa/status/', '');
        if (!checkoutRequestId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'checkoutRequestId is required' }));
          return;
        }

        // 1. Check persistence ledger first
        const ledgerTx = await paymentLedger.getTransactionByCheckoutId(checkoutRequestId);
        if (ledgerTx && (ledgerTx.status === 'completed' || ledgerTx.status === 'failed')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ResponseCode: '0',
              ResponseDescription: ledgerTx.resultDesc || 'Success',
              MerchantRequestID: ledgerTx.merchantRequestId,
              CheckoutRequestID: ledgerTx.checkoutRequestId,
              ResultCode: ledgerTx.resultCode ?? (ledgerTx.status === 'completed' ? 0 : 1032),
              ResultDesc: ledgerTx.resultDesc || 'Success',
              status: ledgerTx.status,
              mpesaReceiptNumber: ledgerTx.mpesaReceipt,
            })
          );
          return;
        }

        // 2. Query M-Pesa client adapter
        const mpesaClient = getMpesaClient();
        const response = await mpesaClient.queryStkStatus(checkoutRequestId);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err?.message || 'Failed to query STK status' }));
      }
      return;
    }

    // 7. M-Pesa Mock Callback Simulation Endpoint (for offline testing & dev)
    if (url === '/api/payments/mpesa/mock-simulate' && method === 'POST') {
      try {
        const body = await parseJsonBody<{ checkoutRequestId: string; success?: boolean }>(req);
        if (!body.checkoutRequestId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'checkoutRequestId is required' }));
          return;
        }

        const mpesaClient = getMpesaClient();
        const result = await mpesaClient.simulateCallback(
          body.checkoutRequestId,
          body.success !== false
        );

        // Update persistence ledger
        const updatedTx = await paymentLedger.applyCallbackResult(result);

        if (result.success && updatedTx && io) {
          io.to(updatedTx.boardId).emit('payment:confirmed', {
            boardId: updatedTx.boardId,
            planType: updatedTx.planType,
            amountKes: updatedTx.amount,
            mpesaReceipt: result.mpesaReceiptNumber,
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err?.message || 'Mock simulation failed' }));
      }
      return;
    }

    // 8. Board Plan Tier Query Endpoint
    if (url.startsWith('/api/payments/mpesa/plan/') && method === 'GET') {
      try {
        const boardId = url.replace('/api/payments/mpesa/plan/', '');
        if (!boardId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'boardId is required' }));
          return;
        }

        const planInfo = await paymentLedger.getBoardPlan(boardId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(planInfo));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err?.message || 'Failed to query board plan' }));
      }
      return;
    }

    // 9. Board Transactions History Endpoint
    if (url.startsWith('/api/payments/mpesa/transactions/') && method === 'GET') {
      try {
        const boardId = url.replace('/api/payments/mpesa/transactions/', '');
        if (!boardId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'boardId is required' }));
          return;
        }

        const txs = await paymentLedger.getTransactionsByBoardId(boardId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ boardId, transactions: txs }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err?.message || 'Failed to query transactions' }));
      }
      return;
    }

    // 10. Africa's Talking Generic SMS Dispatch Endpoint
    if (url === '/api/notifications/sms/send' && method === 'POST') {
      try {
        const body = await parseJsonBody<unknown>(req);
        const validated = AfricaTalkingSmsRequestSchema.parse(body);
        const atClient = getAfricaTalkingClient();
        const response = await atClient.sendSms(validated);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err: any) {
        const statusCode = err?.name === 'ZodError' ? 400 : 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: err?.message || "Failed to dispatch Africa's Talking SMS",
            issues: err?.issues,
          })
        );
      }
      return;
    }

    // 11. Africa's Talking Collaborator Board Invite SMS Endpoint
    if (url === '/api/notifications/sms/invite' && method === 'POST') {
      try {
        const body = await parseJsonBody<{
          boardId: string;
          boardTitle?: string;
          inviterName: string;
          recipientPhone: string;
          appBaseUrl?: string;
          locale?: 'en' | 'sw';
        }>(req);

        if (!body.boardId || !body.inviterName || !body.recipientPhone) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'boardId, inviterName, and recipientPhone are required fields',
            })
          );
          return;
        }

        if (!isValidKenyanPhone(body.recipientPhone)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Invalid Kenyan phone number for SMS invite delivery',
            })
          );
          return;
        }

        const atClient = getAfricaTalkingClient();
        const response = await atClient.sendBoardInvite(body);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: err?.message || 'Failed to dispatch board invite SMS',
          })
        );
      }
      return;
    }

    // 12. Africa's Talking Mock Outbox Query Endpoint (dev/test only)
    if (url === '/api/notifications/sms/outbox' && method === 'GET') {
      const atClient = getAfricaTalkingClient();
      if (atClient instanceof MockAfricaTalkingClient) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ outbox: atClient.getOutbox() }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ outbox: [] }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: config.maxPayloadBytes * 2,
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling'],
  });

  // Attach Socket.io handlers
  setupSocketHandlers(io, sessionManager);

  return { server, io, sessionManager };
}

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    await storage.init();
    await paymentLedger.init();
    const { server, io, sessionManager } = createSketchboardServer();
    await redisService.init(io);

    server.listen(config.port, config.host, () => {
      console.log(
        `[Sketchboard Server] Listening on http://${config.host}:${config.port} (node: ${config.nodeId}, mpesaMock: ${config.mpesaMock}, atMock: ${config.africasTalkingMock})`
      );
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`[Sketchboard Server] Received ${signal}. Draining sockets and flushing state...`);
      io.emit('server:shutdown', { message: 'Server is restarting, reconnecting...' });

      try {
        await sessionManager.flushAllOnShutdown();
        await redisService.close();
        await paymentLedger.close();
        await storage.close();

        server.close(() => {
          console.log('[Sketchboard Server] Graceful shutdown complete.');
          process.exit(0);
        });
      } catch (err) {
        console.error('[Sketchboard Server] Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })();
}
