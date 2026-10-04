import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { eq } from 'drizzle-orm';
import { db, servers } from '@octopus/database';
import { config } from '../config.js';

const PATH_PATTERN = /^\/api\/v1\/client\/servers\/([^/]+)\/ws\/?$/;

interface WsTokenPayload {
  sub: number;
  serverUuid: string;
  type: string;
}

const wss = new WebSocketServer({ noServer: true });

function nodeWsBases(fqdn: string, apiPort: number): string[] {
  const host = fqdn.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const scheme = fqdn.startsWith('https://') ? 'wss' : 'ws';
  const primary = `${scheme}://${host}:${apiPort}`;
  const loopback = `ws://127.0.0.1:${apiPort}`;
  const bases: string[] = [];
  // If local / loopback host, only use loopback
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return [loopback];
  }
  // Otherwise try primary FQDN, with loopback fallback for co-located panel/daemon setups
  bases.push(primary);
  if (!bases.includes(loopback)) bases.push(loopback);
  return bases;
}

function sendNotice(client: WebSocket, message: string) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(
      JSON.stringify({
        event: 'console_output',
        args: [`\r\n\x1b[33m[OctopusPanel] ${message}\x1b[0m\r\n`],
      }),
    );
  }
}

function connectUpstream(urls: string[], daemonToken: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let lastError: Error | null = null;
    const tryNext = (i: number) => {
      if (i >= urls.length) {
        reject(lastError || new Error('No upstream reachable'));
        return;
      }
      const upstream = new WebSocket(urls[i], { handshakeTimeout: 5000 });
      let settled = false;

      upstream.once('open', () => {
        settled = true;
        try {
          upstream.send(JSON.stringify({ event: 'auth', args: [daemonToken] }));
        } catch {}
        resolve(upstream);
      });

      upstream.once('unexpected-response', (_req: any, res: any) => {
        if (!settled) {
          settled = true;
          let body = '';
          res.on('data', (chunk: any) => (body += chunk));
          res.on('end', () => {
            lastError = new Error(`Tentacle HTTP ${res.statusCode}: ${body || res.statusMessage}`);
            tryNext(i + 1);
          });
        }
      });

      upstream.once('error', (err: any) => {
        if (!settled) {
          settled = true;
          lastError = err;
          tryNext(i + 1);
        }
      });
    };
    tryNext(0);
  });
}

// Tentacle expects { event, command } or { event, args: [cmd] } depending on version.
function normalizeClientMessage(raw: RawData): string {
  const text = raw.toString();
  try {
    const msg = JSON.parse(text);
    if (!msg || typeof msg !== 'object') return text;

    if (msg.event === 'send_command') {
      const cmd = msg.command ?? (Array.isArray(msg.args) ? msg.args[0] : undefined);
      if (cmd !== undefined) {
        msg.command = String(cmd);
        msg.args = [String(cmd)];
      }
    } else if (msg.event === 'power' || msg.event === 'set_state') {
      const act = msg.action ?? (Array.isArray(msg.args) ? msg.args[0] : undefined);
      if (act !== undefined) {
        msg.event = 'set_state';
        msg.action = String(act);
        msg.args = [String(act)];
      }
    }
    return JSON.stringify(msg);
  } catch {
    return text;
  }
}

async function handleConnection(client: WebSocket, param: string, token: string) {
  let payload: WsTokenPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as unknown as WsTokenPayload;
  } catch {
    sendNotice(client, 'Console token invalid or expired. Reload the page.');
    client.close(4401, 'unauthorized');
    return;
  }

  const isNumeric = /^\d+$/.test(param);
  const server = await db.query.servers.findFirst({
    where: isNumeric ? eq(servers.id, parseInt(param, 10)) : eq(servers.uuid, param),
    with: { node: true },
  });

  if (!server || payload.type !== 'ws_console' || payload.serverUuid !== server.uuid) {
    sendNotice(client, 'Console token does not match this server.');
    client.close(4403, 'forbidden');
    return;
  }

  const urls = nodeWsBases(server.node.fqdn, server.node.apiPort).map(
    (base) => `${base}/api/servers/${server.uuid}/ws?token=${encodeURIComponent(server.node.tokenHash)}`,
  );

  let upstream: WebSocket;
  try {
    upstream = await connectUpstream(urls, server.node.tokenHash);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (/404|not found/i.test(msg)) {
      sendNotice(client, 'Server is not provisioned on the node yet. Press Start to provision it.');
    } else {
      sendNotice(client, `Could not reach node daemon: ${msg}`);
    }
    setTimeout(() => {
      if (client.readyState === WebSocket.OPEN) client.close(1011, 'upstream unavailable');
    }, 800);
    return;
  }

  upstream.on('message', (data: RawData) => {
    if (client.readyState === WebSocket.OPEN) client.send(data.toString());
  });
  client.on('message', (data: RawData) => {
    if (upstream.readyState === WebSocket.OPEN) upstream.send(normalizeClientMessage(data));
  });

  const closeBoth = () => {
    if (client.readyState === WebSocket.OPEN) client.close();
    if (upstream.readyState === WebSocket.OPEN) upstream.close();
  };
  upstream.on('close', closeBoth);
  upstream.on('error', closeBoth);
  client.on('close', closeBoth);
  client.on('error', closeBoth);
}

export function attachConsoleProxy(httpServer: { on: (event: 'upgrade', cb: (...args: any[]) => void) => unknown }) {
  httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const match = url.pathname.match(PATH_PATTERN);
    if (!match) {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token') || '';
    wss.handleUpgrade(req, socket, head, (client: WebSocket) => {
      handleConnection(client, decodeURIComponent(match[1]), token).catch((err: any) => {
        sendNotice(client, `Console proxy error: ${err?.message || err}`);
        client.close(1011);
      });
    });
  });
}
