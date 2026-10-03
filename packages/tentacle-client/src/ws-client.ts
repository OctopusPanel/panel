import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import { PowerAction, ServerStatus } from '@octopus/shared';
import { TentacleWsMessage } from './types.js';

export interface TentacleWsClientOptions {
  serverUuid: string;
  wsUrl: string; // e.g. ws://127.0.0.1:8080/api/servers/:uuid/ws
  token: string;
  reconnect?: boolean;
}

export class TentacleWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private isClosedManually = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly options: TentacleWsClientOptions;

  constructor(options: TentacleWsClientOptions) {
    super();
    this.options = options;
  }

  connect(): void {
    this.isClosedManually = false;
    const url = new URL(this.options.wsUrl);
    url.searchParams.set('token', this.options.token);

    this.ws = new WebSocket(url.toString());

    this.ws.on('open', () => {
      this.emit('open');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const text = data.toString();
        const parsed = JSON.parse(text) as TentacleWsMessage;

        if (parsed.event === 'console_output' && parsed.args && parsed.args.length > 0) {
          this.emit('console_output', String(parsed.args[0]));
        } else if (parsed.event === 'status' && parsed.args && parsed.args.length > 0) {
          this.emit('status', parsed.args[0] as ServerStatus);
        } else if (parsed.event === 'stats' && parsed.args && parsed.args.length > 0) {
          this.emit('stats', parsed.args[0]);
        } else if (parsed.event === 'token_expiring') {
          this.emit('token_expiring');
        } else {
          this.emit('raw_message', parsed);
        }
      } catch {
        // Raw text line fallback
        this.emit('console_output', data.toString());
      }
    });

    this.ws.on('error', (err: Error) => {
      this.emit('error', err);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.emit('close', code, reason.toString());
      if (!this.isClosedManually && this.options.reconnect !== false) {
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, 3000);
      }
    });
  }

  sendCommand(command: string): void {
    this.sendJson({
      event: 'send_command',
      args: [command],
    });
  }

  sendPower(action: PowerAction): void {
    this.sendJson({
      event: 'set_state',
      args: [action],
    });
  }

  sendJson(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      throw new Error('Tentacle WebSocket is not currently connected');
    }
  }

  disconnect(): void {
    this.isClosedManually = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
