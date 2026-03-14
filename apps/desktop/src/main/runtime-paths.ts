import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const runtimeDir = dirname(fileURLToPath(import.meta.url));
const distRoot = join(runtimeDir, '..');
const appRoot = join(distRoot, '..');

export function getPreloadEntryPath(): string {
  return join(distRoot, 'preload', 'index.js');
}

export function getRendererEntryPath(): string {
  return join(distRoot, 'renderer', 'index.html');
}

export function getTrayIconPath(): string {
  return join(appRoot, 'assets', 'tray-icon.svg');
}
