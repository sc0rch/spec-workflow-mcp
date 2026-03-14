import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type { Rectangle } from 'electron';

export interface WindowState {
  readonly bounds?: Rectangle | undefined;
  readonly isMaximized: boolean;
}

export interface DesktopSettings {
  readonly lastSelectedProjectPath: string | null;
  readonly lastSelectedAt: string | null;
  readonly window: WindowState;
}

const defaultSettings: DesktopSettings = {
  lastSelectedProjectPath: null,
  lastSelectedAt: null,
  window: {
    isMaximized: false
  }
};

export class SettingsStore {
  private readonly settingsPath: string;
  private currentSettings: DesktopSettings = defaultSettings;

  constructor(storageRoot: string) {
    this.settingsPath = join(storageRoot, 'desktop-settings.json');
  }

  async load(): Promise<DesktopSettings> {
    try {
      const raw = await readFile(this.settingsPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DesktopSettings>;
      this.currentSettings = {
        lastSelectedProjectPath: parsed.lastSelectedProjectPath ?? null,
        lastSelectedAt: parsed.lastSelectedAt ?? null,
        window: {
          bounds: parsed.window?.bounds,
          isMaximized: parsed.window?.isMaximized ?? false
        }
      };
    } catch {
      this.currentSettings = defaultSettings;
    }

    return this.currentSettings;
  }

  getSettings(): DesktopSettings {
    return this.currentSettings;
  }

  getSettingsPath(): string {
    return this.settingsPath;
  }

  async setWindowState(windowState: WindowState): Promise<void> {
    this.currentSettings = {
      ...this.currentSettings,
      window: windowState
    };
    await this.persist();
  }

  async setLastSelectedProjectPath(projectPath: string | null): Promise<void> {
    this.currentSettings = {
      ...this.currentSettings,
      lastSelectedProjectPath: projectPath,
      lastSelectedAt: projectPath ? new Date().toISOString() : null
    };
    await this.persist();
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.settingsPath), { recursive: true });
    await writeFile(this.settingsPath, JSON.stringify(this.currentSettings, null, 2), 'utf-8');
  }
}
