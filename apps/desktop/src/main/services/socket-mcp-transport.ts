import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { Socket } from 'net';

export class SocketMcpTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T) => void;

  private readonly readBuffer = new ReadBuffer();
  private started = false;
  private closed = false;
  private readonly onData = (chunk: Buffer) => {
    this.readBuffer.append(chunk);
    this.processReadBuffer();
  };
  private readonly onError = (error: Error) => {
    this.onerror?.(error);
  };
  private readonly onClose = () => {
    this.readBuffer.clear();

    if (this.closed) {
      return;
    }

    this.closed = true;
    this.onclose?.();
  };

  constructor(
    private readonly socket: Pick<Socket, 'on' | 'off' | 'once' | 'write' | 'end' | 'destroy'>,
    pendingData?: Buffer
  ) {
    if (pendingData && pendingData.length > 0) {
      this.readBuffer.append(pendingData);
    }
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('SocketMcpTransport already started');
    }

    this.started = true;
    this.socket.on('data', this.onData);
    this.socket.on('error', this.onError);
    this.socket.once('close', this.onClose);
    this.processReadBuffer();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const payload = serializeMessage(message);
      const callback = (error?: Error | null) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      };

      this.socket.write(payload, callback);
    });
  }

  async close(): Promise<void> {
    this.socket.off('data', this.onData);
    this.socket.off('error', this.onError);
    this.socket.end();
    this.socket.destroy();
    this.onClose();
  }

  private processReadBuffer(): void {
    while (true) {
      try {
        const message = this.readBuffer.readMessage();
        if (!message) {
          return;
        }

        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
}
