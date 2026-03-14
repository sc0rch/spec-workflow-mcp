// @vitest-environment node

import { createConnection, createServer } from 'net';
import { once } from 'events';
import { deserializeMessage, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import { SocketMcpTransport } from './socket-mcp-transport.js';

describe('SocketMcpTransport', () => {
  it('reads and writes newline-delimited MCP messages over a socket', async () => {
    const listeningServer = createServer();
    listeningServer.listen(0, '127.0.0.1');
    await once(listeningServer, 'listening');
    const address = listeningServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Missing test server address');
    }

    const serverSocketPromise = once(listeningServer, 'connection').then(([socket]) => socket);
    const clientSocket = await new Promise<any>((resolvePromise, reject) => {
      const socket = createConnection(address.port, '127.0.0.1');
      socket.once('connect', () => resolvePromise(socket));
      socket.once('error', reject);
    });
    const serverSocket = await serverSocketPromise;

    const transport = new SocketMcpTransport(serverSocket);
    const onMessage = vi.fn();
    transport.onmessage = onMessage;
    await transport.start();

    clientSocket.write(serializeMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'ping'
    }));
    await vi.waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
        method: 'ping'
      }));
    });

    const payloadPromise = once(clientSocket, 'data').then(([chunk]) => deserializeMessage(chunk.toString('utf-8')));
    await transport.send({
      jsonrpc: '2.0',
      id: 1,
      result: {
        ok: true
      }
    });

    await expect(payloadPromise).resolves.toEqual(expect.objectContaining({
      result: {
        ok: true
      }
    }));

    await transport.close();
    clientSocket.destroy();
    listeningServer.close();
  });
});
