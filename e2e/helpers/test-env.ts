// path: e2e/helpers/test-env.ts
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer, ViteDevServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TestEnvironment {
  server: http.Server;
  vite: ViteDevServer;
  baseURL: string;
  serverPort: number;
  close: () => Promise<void>;
}

export async function setupTestEnvironment(): Promise<TestEnvironment> {
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_REDIS = 'false';
  process.env.ENABLE_POSTGRES = 'false';
  process.env.MPESA_MOCK = 'true';
  process.env.AFRICASTALKING_MOCK = 'true';

  const { createSketchboardServer } = await import('../../apps/server/src/index.js');
  const serverInstance = createSketchboardServer();
  const server = serverInstance.server;

  const serverPort = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 4000);
    });
  });

  const webPort = serverPort + 100;
  const vite = await createViteServer({
    root: path.resolve(__dirname, '../../apps/web'),
    server: {
      port: webPort,
      strictPort: false,
      host: '127.0.0.1',
      proxy: {
        '/socket.io': {
          target: `http://127.0.0.1:${serverPort}`,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err: any) => {
              if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err.code)) return;
              console.warn('[Proxy Warning]:', err.message);
            });
          },
        },
        '/api': {
          target: `http://127.0.0.1:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
  });

  await vite.listen();
  const viteAddr = vite.httpServer?.address();
  const actualPort = typeof viteAddr === 'object' && viteAddr ? viteAddr.port : webPort;
  const baseURL = `http://127.0.0.1:${actualPort}`;

  return {
    server,
    vite,
    baseURL,
    serverPort,
    close: async () => {
      try {
        if (vite) await vite.close();
      } catch {
        // ignore
      }
      try {
        if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
      } catch {
        // ignore
      }
    },
  };
}
