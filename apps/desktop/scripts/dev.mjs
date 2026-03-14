import { spawn } from 'child_process';
import { access } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const rendererUrl = 'http://127.0.0.1:5174';

const electronEntry = join(projectRoot, 'dist', 'main', 'index.js');
const preloadEntry = join(projectRoot, 'dist', 'preload', 'index.js');

const childProcesses = [];

function getCommand(command) {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

function spawnProcess(command, args, extraEnv = {}) {
  const child = spawn(getCommand(command), args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv
    }
  });

  childProcesses.push(child);
  child.once('exit', (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
  return child;
}

function shutdown(code = 0) {
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exit(code);
}

async function waitForPath(pathToCheck, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await access(pathToCheck);
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  throw new Error(`Timed out waiting for file: ${pathToCheck}`);
}

async function waitForUrl(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Vite is ready.
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for URL: ${url}`);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

spawnProcess('tsc', ['-p', 'tsconfig.electron.json', '--watch', '--preserveWatchOutput']);
spawnProcess('vite', ['--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', '5174', '--strictPort']);

try {
  await Promise.all([
    waitForPath(electronEntry),
    waitForPath(preloadEntry),
    waitForUrl(rendererUrl)
  ]);

  const electronApp = spawnProcess('electron', ['dist/main/index.js'], {
    SPEC_WORKFLOW_DESKTOP_RENDERER_URL: rendererUrl
  });

  electronApp.once('exit', (code) => {
    shutdown(code ?? 0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}
