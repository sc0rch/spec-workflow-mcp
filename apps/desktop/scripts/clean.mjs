import { rm } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

for (const relativePath of ['dist', 'release', 'playwright-report', 'test-results']) {
  await rm(join(projectRoot, relativePath), { recursive: true, force: true });
}
