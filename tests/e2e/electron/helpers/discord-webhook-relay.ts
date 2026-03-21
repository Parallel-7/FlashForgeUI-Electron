/**
 * @fileoverview Lightweight local Discord webhook relay for live hardware E2E coverage.
 *
 * Captures the exact request body emitted by the application, parses it locally for
 * deterministic assertions, and can optionally forward the raw body to a real Discord
 * webhook URL without reserializing the request.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createNetServer } from 'node:net';

export interface CapturedDiscordAttachment {
  readonly filename: string;
  readonly contentType: string;
  readonly bytes: Buffer;
}

export interface CapturedDiscordWebhookRequest {
  readonly contentType: string;
  readonly payload: Record<string, unknown>;
  readonly attachment: CapturedDiscordAttachment | null;
  readonly rawBody: Buffer;
}

export interface DiscordWebhookRelay {
  readonly webhookUrl: string;
  readonly requests: readonly CapturedDiscordWebhookRequest[];
  reset(): void;
  waitForRequest(params?: {
    timeoutMs?: number;
    predicate?: (request: CapturedDiscordWebhookRequest) => boolean;
  }): Promise<CapturedDiscordWebhookRequest>;
  close(): Promise<void>;
}

type Waiter = {
  readonly predicate: (request: CapturedDiscordWebhookRequest) => boolean;
  readonly resolve: (request: CapturedDiscordWebhookRequest) => void;
  readonly reject: (error: Error) => void;
  readonly timeoutId: NodeJS.Timeout;
};

async function getFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createNetServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to acquire a free port')));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve());
    req.on('error', reject);
  });

  return Buffer.concat(chunks);
}

async function parseCapturedRequest(
  rawBody: Buffer,
  contentType: string
): Promise<CapturedDiscordWebhookRequest> {
  if (contentType.toLowerCase().startsWith('multipart/form-data')) {
    const bodyBytes = Uint8Array.from(rawBody);
    const form = await new Response(bodyBytes, {
      headers: {
        'Content-Type': contentType,
      },
    }).formData();

    const payloadText = form.get('payload_json');
    if (typeof payloadText !== 'string') {
      throw new Error('Multipart webhook body is missing payload_json');
    }

    const attachmentValue = form.get('files[0]');
    if (!attachmentValue || typeof attachmentValue === 'string') {
      throw new Error('Multipart webhook body is missing files[0]');
    }

    const attachmentBytes = Buffer.from(await attachmentValue.arrayBuffer());

    return {
      contentType,
      payload: JSON.parse(payloadText) as Record<string, unknown>,
      attachment: {
        filename: attachmentValue.name,
        contentType: attachmentValue.type || 'application/octet-stream',
        bytes: attachmentBytes,
      },
      rawBody,
    };
  }

  const payloadText = rawBody.toString('utf-8');
  return {
    contentType,
    payload: JSON.parse(payloadText) as Record<string, unknown>,
    attachment: null,
    rawBody,
  };
}

function respondJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(`${JSON.stringify(payload)}\n`);
}

export async function startDiscordWebhookRelay(options?: {
  forwardUrl?: string;
}): Promise<DiscordWebhookRelay> {
  const port = await getFreePort();
  const requests: CapturedDiscordWebhookRequest[] = [];
  const waiters = new Set<Waiter>();

  const fulfillWaiters = (request: CapturedDiscordWebhookRequest): void => {
    for (const waiter of Array.from(waiters)) {
      if (!waiter.predicate(request)) {
        continue;
      }

      clearTimeout(waiter.timeoutId);
      waiters.delete(waiter);
      waiter.resolve(request);
    }
  };

  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhook') {
      respondJson(res, 404, { success: false, error: 'Not found' });
      return;
    }

    const contentType = String(req.headers['content-type'] ?? '');

    try {
      const rawBody = await readRequestBody(req);
      const captured = await parseCapturedRequest(rawBody, contentType);
      requests.push(captured);
      fulfillWaiters(captured);

      if (options?.forwardUrl) {
        const bodyBytes = Uint8Array.from(rawBody);
        const response = await fetch(options.forwardUrl, {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
          },
          body: bodyBytes,
        });
        const responseText = await response.text();

        res.statusCode = response.status;
        if (responseText.length > 0) {
          res.setHeader(
            'Content-Type',
            response.headers.get('content-type') ?? 'text/plain; charset=utf-8'
          );
          res.end(responseText);
          return;
        }

        res.end();
        return;
      }

      res.statusCode = 204;
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respondJson(res, 500, { success: false, error: message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    webhookUrl: `http://127.0.0.1:${port}/webhook`,
    requests,
    reset(): void {
      requests.length = 0;
    },
    async waitForRequest(params?: {
      timeoutMs?: number;
      predicate?: (request: CapturedDiscordWebhookRequest) => boolean;
    }): Promise<CapturedDiscordWebhookRequest> {
      const predicate = params?.predicate ?? (() => true);
      const existing = requests.find((request) => predicate(request));
      if (existing) {
        return existing;
      }

      const timeoutMs = params?.timeoutMs ?? 20_000;

      return await new Promise<CapturedDiscordWebhookRequest>((resolve, reject) => {
        const waiter: Waiter = {
          predicate,
          resolve,
          reject,
          timeoutId: setTimeout(() => {
            waiters.delete(waiter);
            reject(new Error(`Timed out waiting for Discord relay request after ${timeoutMs}ms`));
          }, timeoutMs),
        };

        waiters.add(waiter);
      });
    },
    async close(): Promise<void> {
      for (const waiter of Array.from(waiters)) {
        clearTimeout(waiter.timeoutId);
        waiter.reject(new Error('Discord relay closed before the expected request arrived'));
      }
      waiters.clear();

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
