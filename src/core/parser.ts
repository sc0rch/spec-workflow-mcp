import { access, readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { PathUtils } from './path-utils.js';
import { SpecData, SteeringStatus, PhaseStatus } from '../types.js';
import { parseTaskProgress } from './task-parser.js';

export interface ParsedSpec extends SpecData {
  displayName: string;
}

export class SpecParser {
  private readonly specsPath: string;
  private readonly archiveSpecsPath: string;
  private readonly steeringPath: string;

  constructor(private readonly projectPath: string) {
    this.specsPath = PathUtils.getSpecPath(projectPath, '');
    this.archiveSpecsPath = PathUtils.getArchiveSpecsPath(projectPath);
    this.steeringPath = PathUtils.getSteeringPath(projectPath);
  }

  async getAllSpecs(): Promise<ParsedSpec[]> {
    return this.listSpecsFromPath(this.specsPath, (name) => this.getSpec(name));
  }

  async getAllArchivedSpecs(): Promise<ParsedSpec[]> {
    return this.listSpecsFromPath(this.archiveSpecsPath, (name) => this.getArchivedSpec(name));
  }

  async getSpec(name: string): Promise<ParsedSpec | null> {
    return this.readSpecAtPath(PathUtils.getSpecPath(this.projectPath, name), name);
  }

  async getArchivedSpec(name: string): Promise<ParsedSpec | null> {
    return this.readSpecAtPath(PathUtils.getArchiveSpecPath(this.projectPath, name), name);
  }

  async getProjectSteeringStatus(): Promise<SteeringStatus> {
    const status: SteeringStatus = {
      exists: false,
      documents: {
        product: false,
        tech: false,
        structure: false
      }
    };

    try {
      await access(this.steeringPath);
      status.exists = true;

      try {
        await access(join(this.steeringPath, 'product.md'));
        status.documents.product = true;
      } catch {
        // Product steering doc is optional.
      }

      try {
        await access(join(this.steeringPath, 'tech.md'));
        status.documents.tech = true;
      } catch {
        // Tech steering doc is optional.
      }

      try {
        await access(join(this.steeringPath, 'structure.md'));
        status.documents.structure = true;
      } catch {
        // Structure steering doc is optional.
      }

      const steeringStats = await stat(this.steeringPath);
      status.lastModified = steeringStats.mtime.toISOString();
    } catch {
      // Steering directory does not exist yet.
    }

    return status;
  }

  private async listSpecsFromPath(
    specsPath: string,
    readSpec: (name: string) => Promise<ParsedSpec | null>
  ): Promise<ParsedSpec[]> {
    try {
      await access(specsPath);
      const entries = await readdir(specsPath, { withFileTypes: true });
      const specDirs = entries.filter((entry) => entry.isDirectory());

      const specs: ParsedSpec[] = [];
      for (const dir of specDirs) {
        const spec = await readSpec(dir.name);
        if (spec) {
          specs.push(spec);
        }
      }

      return specs.sort((left, right) => left.name.localeCompare(right.name));
    } catch {
      return [];
    }
  }

  private async readSpecAtPath(specPath: string, name: string): Promise<ParsedSpec | null> {
    try {
      await access(specPath);
      const spec: ParsedSpec = {
        name,
        displayName: this.formatDisplayName(name),
        createdAt: '',
        lastModified: '',
        phases: {
          requirements: { exists: false },
          design: { exists: false },
          tasks: { exists: false },
          implementation: { exists: false }
        }
      };

      const dirStats = await stat(specPath);
      if (!dirStats.isDirectory()) {
        return null;
      }

      spec.createdAt = dirStats.birthtime.toISOString();
      spec.lastModified = dirStats.mtime.toISOString();

      let hasAnyDocument = false;
      const requirements = await this.getPhaseStatus(specPath, 'requirements.md');
      if (requirements.exists) {
        hasAnyDocument = true;
        spec.phases.requirements = requirements;
        spec.lastModified = this.getLatestTimestamp(spec.lastModified, requirements.lastModified);
      }

      const design = await this.getPhaseStatus(specPath, 'design.md');
      if (design.exists) {
        hasAnyDocument = true;
        spec.phases.design = design;
        spec.lastModified = this.getLatestTimestamp(spec.lastModified, design.lastModified);
      }

      const tasks = await this.getPhaseStatus(specPath, 'tasks.md');
      if (tasks.exists) {
        hasAnyDocument = true;
        spec.phases.tasks = tasks;
        spec.lastModified = this.getLatestTimestamp(spec.lastModified, tasks.lastModified);

        try {
          const tasksContent = await readFile(join(specPath, 'tasks.md'), 'utf-8');
          const taskProgress = parseTaskProgress(tasksContent);
          spec.taskProgress = {
            total: taskProgress.total,
            completed: taskProgress.completed,
            pending: taskProgress.pending
          };
        } catch {
          // Ignore task progress parsing failures for now.
        }
      }

      if (!hasAnyDocument) {
        return null;
      }

      spec.phases.implementation.exists = true;
      return spec;
    } catch {
      return null;
    }
  }

  private async getPhaseStatus(basePath: string, filename: string): Promise<PhaseStatus> {
    const filePath = join(basePath, filename);

    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        throw new Error('not-a-file');
      }

      return {
        exists: true,
        lastModified: stats.mtime.toISOString(),
        content: await readFile(filePath, 'utf-8')
      };
    } catch {
      return {
        exists: false
      };
    }
  }

  private formatDisplayName(kebabCase: string): string {
    return kebabCase
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getLatestTimestamp(current: string, candidate?: string): string {
    if (!candidate) {
      return current;
    }

    const currentTime = Date.parse(current) || 0;
    const candidateTime = Date.parse(candidate) || 0;
    return candidateTime > currentTime ? candidate : current;
  }
}
