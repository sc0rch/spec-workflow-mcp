import { mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { PathUtils } from './path-utils.js';

export type SpecDocumentName = 'requirements' | 'design' | 'tasks';

export interface SaveSpecDocumentInput {
  workflowRootPath: string;
  specName: string;
  document: SpecDocumentName;
  content: string;
}

export interface SaveSpecDocumentResult {
  filePath: string;
  savedAt: string;
}

const allowedDocuments = new Set<SpecDocumentName>(['requirements', 'design', 'tasks']);

export class SpecDocumentsService {
  async saveDocument(input: SaveSpecDocumentInput): Promise<SaveSpecDocumentResult> {
    const document = validateDocumentName(input.document);
    const specPath = PathUtils.getSpecPath(input.workflowRootPath, input.specName);
    const filePath = join(specPath, `${document}.md`);

    await mkdir(specPath, { recursive: true });
    await writeFile(filePath, input.content, 'utf-8');

    const fileStats = await stat(filePath);

    return {
      filePath,
      savedAt: fileStats.mtime.toISOString()
    };
  }
}

function validateDocumentName(value: string): SpecDocumentName {
  if (allowedDocuments.has(value as SpecDocumentName)) {
    return value as SpecDocumentName;
  }

  throw new Error('Invalid spec document type');
}
