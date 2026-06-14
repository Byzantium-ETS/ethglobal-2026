import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export type JsonFetchResult<T = unknown> = {
  status: number;
  headers: Headers;
  body: T;
  text: string;
};

export function serverUrl(server: Server, path = ''): string {
  const address = server.address() as AddressInfo | null;
  if (!address) throw new Error('[smoke] server is not listening');
  return `http://127.0.0.1:${address.port}${path}`;
}

export async function readJson<T = unknown>(response: Response): Promise<JsonFetchResult<T>> {
  const text = await response.text();
  const body = text ? JSON.parse(text) as T : null as T;
  return {
    status: response.status,
    headers: response.headers,
    body,
    text,
  };
}

export async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}