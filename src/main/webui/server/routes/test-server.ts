/**
 * @fileoverview Lightweight Express test server helper used by route tests
 * to stand up isolated HTTP fixtures on random local ports.
 */

import express from 'express';
import type { Server } from 'http';
import { AddressInfo } from 'net';

export interface TestServerHandle {
  readonly baseUrl: string;
  close(): Promise<void>;
}

export async function startTestServer(configureApp: (app: express.Application) => void): Promise<TestServerHandle> {
  const app = express();
  app.use(express.json());
  configureApp(app);

  const server = await new Promise<Server>((resolve) => {
    const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
  });
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise<void>((resolve, reject) => {
        // undici (global fetch) holds its sockets open with keep-alive. Node 19+
        // drops idle connections on close(), but Node 18 waits for the 5s
        // keep-alive timeout, which stalls the closing test past Jest's limit.
        server.closeAllConnections?.();
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
