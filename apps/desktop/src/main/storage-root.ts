import type { App } from 'electron';
import { isAbsolute, resolve } from 'path';

export const DESKTOP_STORAGE_ROOT_ENV = 'SPEC_WORKFLOW_DESKTOP_STORAGE_ROOT';

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
