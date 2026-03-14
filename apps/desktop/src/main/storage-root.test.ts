// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { resolve } from 'path';
import {
  DESKTOP_STORAGE_ROOT_ENV,
  configureDesktopStorageRoot,
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
});
