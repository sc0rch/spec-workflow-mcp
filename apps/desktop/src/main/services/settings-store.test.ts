// @vitest-environment node

import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { SettingsStore } from './settings-store.js';

describe('SettingsStore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'spec-workflow-desktop-settings-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('persists selected project path and window state', async () => {
    const store = new SettingsStore(tempDir);
    await store.load();

    await store.setLastSelectedProjectPath('/tmp/repo-a');
    await store.setWindowState({
      isMaximized: true,
      bounds: {
        x: 10,
        y: 20,
        width: 1280,
        height: 820
      }
    });

    const reloadedStore = new SettingsStore(tempDir);
    const settings = await reloadedStore.load();

    expect(settings.lastSelectedProjectPath).toBe('/tmp/repo-a');
    expect(settings.window.isMaximized).toBe(true);
    expect(settings.window.bounds?.width).toBe(1280);
  });

  it('writes settings to the configured file path', async () => {
    const store = new SettingsStore(tempDir);
    await store.load();
    await store.setLastSelectedProjectPath('/tmp/repo-b');

    const content = await readFile(store.getSettingsPath(), 'utf-8');
    expect(content).toContain('/tmp/repo-b');
  });
});
