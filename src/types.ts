export type BoundProjectSource = 'explicit-arg' | 'cwd';

export interface BoundProject {
  requestedPath: string;
  workspacePath: string;
  workflowRootPath: string;
  translatedWorkspacePath: string;
  translatedWorkflowRootPath: string;
  noSharedWorktreeSpecs: boolean;
  source: BoundProjectSource;
}

export interface CommandProjectContext {
  projectPath: string;
  workspacePath?: string;
  workflowRoot: string;
  specName?: string;
  currentPhase?: string;
}

export interface CommandResult<TData = unknown> {
  success: boolean;
  message: string;
  data?: TData;
  nextSteps?: string[];
  projectContext?: CommandProjectContext;
}

export interface SpecData {
  name: string;
  description?: string;
  createdAt: string;
  lastModified: string;
  phases: {
    requirements: PhaseStatus;
    design: PhaseStatus;
    tasks: PhaseStatus;
    implementation: PhaseStatus;
  };
  taskProgress?: {
    total: number;
    completed: number;
    pending: number;
  };
}

export interface PhaseStatus {
  exists: boolean;
  approved?: boolean;
  lastModified?: string;
  content?: string;
}

export interface SteeringStatus {
  exists: boolean;
  documents: {
    product: boolean;
    tech: boolean;
    structure: boolean;
  };
  lastModified?: string;
}

export interface ImplementationLogEntry {
  id: string;
  taskId: string;
  timestamp: string;
  summary: string;
  filesModified: string[];
  filesCreated: string[];
  statistics: {
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
  };
  artifacts: {
    apiEndpoints?: Array<{
      method: string;
      path: string;
      purpose: string;
      requestFormat?: string;
      responseFormat?: string;
      location: string;
    }>;
    components?: Array<{
      name: string;
      type: string;
      purpose: string;
      location: string;
      props?: string;
      exports?: string[];
    }>;
    functions?: Array<{
      name: string;
      purpose: string;
      location: string;
      signature?: string;
      isExported: boolean;
    }>;
    classes?: Array<{
      name: string;
      purpose: string;
      location: string;
      methods?: string[];
      isExported: boolean;
    }>;
    integrations?: Array<{
      description: string;
      frontendComponent: string;
      backendEndpoint: string;
      dataFlow: string;
    }>;
  };
}

export interface ImplementationLog {
  entries: ImplementationLogEntry[];
  lastUpdated?: string;
}
