import type { App } from 'electron';
import { homedir } from 'os';
import { isAbsolute, resolve, win32 as win32Path } from 'path';

export const DESKTOP_STORAGE_ROOT_ENV = 'SPEC_WORKFLOW_DESKTOP_STORAGE_ROOT';
export const DESKTOP_PRODUCT_NAME = 'Spec Workflow Desktop';

export function getDefaultDesktopStorageRoot(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (platform === 'darwin') {
    return resolve(homedir(), 'Library', 'Application Support', DESKTOP_PRODUCT_NAME);
  }

  if (platform === 'win32') {
    const appDataRoot = env.APPDATA?.trim()
      ? env.APPDATA
      : win32Path.join(homedir(), 'AppData', 'Roaming');
    return win32Path.join(appDataRoot, DESKTOP_PRODUCT_NAME);
  }

  const configRoot = env.XDG_CONFIG_HOME?.trim()
    ? env.XDG_CONFIG_HOME
    : resolve(homedir(), '.config');
  return resolve(configRoot, DESKTOP_PRODUCT_NAME);
}

export function resolveDesktopStorageRoot(
  defaultStorageRoot: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const configuredRoot = env[DESKTOP_STORAGE_ROOT_ENV]?.trim();
  if (!configuredRoot) {
    return defaultStorageRoot;
  }

  return isAbsolute(configuredRoot)
    ? configuredRoot
    : resolve(process.cwd(), configuredRoot);
}

export function configureDesktopStorageRoot(
  app: Pick<App, 'getPath' | 'setPath'>,
  env: NodeJS.ProcessEnv = process.env
): string {
  const defaultStorageRoot = app.getPath('userData');
  const storageRoot = resolveDesktopStorageRoot(defaultStorageRoot, env);

  if (storageRoot !== defaultStorageRoot) {
    app.setPath('userData', storageRoot);
  }

  return storageRoot;
}
