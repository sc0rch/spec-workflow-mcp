import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';

export async function ensureWritableStorage(storageRoot: string): Promise<void> {
  await mkdir(storageRoot, { recursive: true });
  const probePath = join(storageRoot, '.desktop-write-check');
  await writeFile(probePath, 'ok', 'utf-8');
  await rm(probePath, { force: true });
}
