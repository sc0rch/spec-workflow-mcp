import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const guidesDir = join(__dirname, '..', 'markdown', 'guides');

export async function loadGuideFile(fileName: string): Promise<string> {
  const filePath = join(guidesDir, fileName);
  return readFile(filePath, 'utf-8');
}
