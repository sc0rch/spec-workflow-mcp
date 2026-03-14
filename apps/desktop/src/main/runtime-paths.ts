import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const runtimeDir = dirname(fileURLToPath(import.meta.url));
const distRoot = findAncestor(runtimeDir, 'dist');
const appRoot = distRoot ? dirname(distRoot) : join(runtimeDir, '..', '..');

export function getPreloadEntryPath(): string {
  return resolveFromDistRoot('apps', 'desktop', 'src', 'preload', 'index.js');
}

export function getRendererEntryPath(): string {
  return resolveFromDistRoot('renderer', 'index.html');
}

export function getTrayIconPath(): string {
  return join(appRoot, 'assets', 'tray-icon.svg');
}

function resolveFromDistRoot(...segments: string[]): string {
  return join(distRoot ?? runtimeDir, ...segments);
}

function findAncestor(startPath: string, expectedBaseName: string): string | null {
  let currentPath = startPath;

  while (true) {
    if (basename(currentPath) === expectedBaseName) {
      return currentPath;
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}
