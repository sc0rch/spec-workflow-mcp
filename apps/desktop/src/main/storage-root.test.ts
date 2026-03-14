// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { resolve } from 'path';
import {
  DESKTOP_PRODUCT_NAME,
  DESKTOP_STORAGE_ROOT_ENV,
  configureDesktopStorageRoot,
  getDefaultDesktopStorageRoot,
  resolveDesktopStorageRoot
} from './storage-root.js';

describe('storage root configuration', () => {
  it('keeps the default userData path when no override is configured', () => {
    const setPath = vi.fn();

    const storageRoot = configureDesktopStorageRoot(
      {
        getPath: () => '/Users/test/Library/Application Support/Spec Workflow Desktop',
        setPath
      },
      {}
    );

    expect(storageRoot).toBe('/Users/test/Library/Application Support/Spec Workflow Desktop');
    expect(setPath).not.toHaveBeenCalled();
  });

  it('uses an absolute override for desktop userData', () => {
    const setPath = vi.fn();

    const storageRoot = configureDesktopStorageRoot(
      {
        getPath: () => '/Users/test/Library/Application Support/Spec Workflow Desktop',
        setPath
      },
      {
        [DESKTOP_STORAGE_ROOT_ENV]: '/tmp/spec-workflow-desktop-tests'
      }
    );

    expect(storageRoot).toBe('/tmp/spec-workflow-desktop-tests');
    expect(setPath).toHaveBeenCalledWith('userData', '/tmp/spec-workflow-desktop-tests');
  });

  it('resolves a relative override against the current working directory', () => {
    expect(
      resolveDesktopStorageRoot('/tmp/default-desktop-root', {
        [DESKTOP_STORAGE_ROOT_ENV]: './.tmp-desktop-user-data'
      })
    ).toBe(resolve(process.cwd(), '.tmp-desktop-user-data'));
  });

  it('derives the default storage root consistently outside Electron', () => {
    expect(getDefaultDesktopStorageRoot('darwin')).toContain(`/Library/Application Support/${DESKTOP_PRODUCT_NAME}`);
    expect(getDefaultDesktopStorageRoot('linux', { XDG_CONFIG_HOME: '/tmp/xdg-config-home' })).toBe(
      `/tmp/xdg-config-home/${DESKTOP_PRODUCT_NAME}`
    );
    expect(getDefaultDesktopStorageRoot('win32', { APPDATA: 'C:\\Users\\Test\\AppData\\Roaming' })).toBe(
      `C:\\Users\\Test\\AppData\\Roaming\\${DESKTOP_PRODUCT_NAME}`
    );
  });
});
