import { describe, it, expect } from 'vitest';
import { MultiProjectDashboardServer } from '../multi-server.js';

describe('MultiProjectDashboardServer.getUrl', () => {
  it('uses 127.0.0.1 for the default local bind address', () => {
    const server = new MultiProjectDashboardServer({ port: 5000, bindAddress: '127.0.0.1' });
    (server as any).actualPort = 5000;

    expect(server.getUrl()).toBe('http://127.0.0.1:5000');
  });

  it('normalizes localhost to 127.0.0.1 for browser-facing URLs', () => {
    const server = new MultiProjectDashboardServer({ port: 5000, bindAddress: 'localhost' });
    (server as any).actualPort = 5000;

    expect(server.getUrl()).toBe('http://127.0.0.1:5000');
  });

  it('keeps external bind addresses unchanged', () => {
    const server = new MultiProjectDashboardServer({
      port: 5000,
      bindAddress: '192.168.1.50',
      allowExternalAccess: true
    });
    (server as any).actualPort = 5000;

    expect(server.getUrl()).toBe('http://192.168.1.50:5000');
  });
});
