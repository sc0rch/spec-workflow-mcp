import { BrowserWindow, shell } from 'electron';
import type { WindowState } from './services/settings-store.js';
import { getPreloadEntryPath, getRendererEntryPath } from './runtime-paths.js';

export interface MainWindowOptions {
  readonly initialState: WindowState;
  readonly rendererUrl?: string | undefined;
  readonly startHidden?: boolean;
  readonly onWindowStateChanged?: (windowState: WindowState) => void | Promise<void>;
}

const defaultWindowBounds = {
  width: 1280,
  height: 820
} as const;

export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  const bounds = options.initialState.bounds;
  const browserWindowOptions = {
    width: bounds?.width ?? defaultWindowBounds.width,
    height: bounds?.height ?? defaultWindowBounds.height,
    minWidth: 1040,
    minHeight: 720,
    show: false,
    backgroundColor: '#10191f',
    title: 'Spec Workflow Desktop',
    webPreferences: {
      preload: getPreloadEntryPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  };
  const window = new BrowserWindow({
    ...browserWindowOptions,
    ...(typeof bounds?.x === 'number' ? { x: bounds.x } : {}),
    ...(typeof bounds?.y === 'number' ? { y: bounds.y } : {})
  });

  if (!options.startHidden) {
    window.once('ready-to-show', () => {
      window.show();
    });
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (options.initialState.isMaximized) {
    window.maximize();
  }

  if (options.onWindowStateChanged) {
    let persistTimer: NodeJS.Timeout | undefined;
    const schedulePersist = () => {
      if (persistTimer) {
        clearTimeout(persistTimer);
      }

      persistTimer = setTimeout(() => {
        void options.onWindowStateChanged?.(readWindowState(window));
      }, 120);
    };

    window.on('move', schedulePersist);
    window.on('resize', schedulePersist);
    window.on('maximize', schedulePersist);
    window.on('unmaximize', schedulePersist);
    window.on('closed', () => {
      if (persistTimer) {
        clearTimeout(persistTimer);
      }
    });
  }

  if (options.rendererUrl) {
    void window.loadURL(options.rendererUrl);
  } else {
    void window.loadFile(getRendererEntryPath());
  }

  return window;
}

function readWindowState(window: BrowserWindow): WindowState {
  return {
    bounds: window.getNormalBounds(),
    isMaximized: window.isMaximized()
  };
}
