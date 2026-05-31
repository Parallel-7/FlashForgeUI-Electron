/**
 * @fileoverview Lightweight Express test server helper used by route tests
 * to stand up isolated HTTP fixtures on random local ports.
 */

/**
 * @fileoverview Test helper for temporary Express route/server instances.
 *
 * Provides a lightweight ephemeral HTTP server wrapper used by WebUI route and
 * middleware tests to exercise real request/response behavior.
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
