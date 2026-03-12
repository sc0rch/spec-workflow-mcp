import { describe, it, expect } from 'vitest';
import { MultiProjectDashboardServer } from '../multi-server.js';
import { DEFAULT_DASHBOARD_PORT } from '../../core/security-utils.js';

describe('MultiProjectDashboardServer.getUrl', () => {
  it('uses localhost for the default local bind address', () => {
    const server = new MultiProjectDashboardServer({ port: DEFAULT_DASHBOARD_PORT, bindAddress: '127.0.0.1' });
    (server as any).actualPort = DEFAULT_DASHBOARD_PORT;

    expect(server.getUrl()).toBe(`http://localhost:${DEFAULT_DASHBOARD_PORT}`);
  });

  it('normalizes localhost binds to localhost for browser-facing URLs', () => {
    const server = new MultiProjectDashboardServer({ port: DEFAULT_DASHBOARD_PORT, bindAddress: 'localhost' });
    (server as any).actualPort = DEFAULT_DASHBOARD_PORT;

    expect(server.getUrl()).toBe(`http://localhost:${DEFAULT_DASHBOARD_PORT}`);
  });

  it('keeps external bind addresses unchanged', () => {
    const server = new MultiProjectDashboardServer({
      port: DEFAULT_DASHBOARD_PORT,
      bindAddress: '192.168.1.50',
      allowExternalAccess: true
    });
    (server as any).actualPort = DEFAULT_DASHBOARD_PORT;

    expect(server.getUrl()).toBe(`http://192.168.1.50:${DEFAULT_DASHBOARD_PORT}`);
  });
});
