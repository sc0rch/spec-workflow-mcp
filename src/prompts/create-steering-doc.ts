import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { PromptDefinition } from './types.js';
import { ToolContext } from '../types.js';

const prompt: Prompt = {
  name: 'create-steering-doc',
  title: 'Create Steering Document',
  description: 'Guide for creating project steering documents (product, tech, structure) directly in the file system. These provide high-level project guidance.',
  arguments: [
    {
      name: 'docType',
      description: 'Type of steering document: product, tech, or structure',
      required: true
    },
    {
      name: 'scope',
      description: 'Scope of the steering document (e.g., frontend, backend, full-stack)',
      required: false
    },
    {
      name: 'projectPath',
      description: 'Workspace/worktree path to bind downstream spec-workflow tool calls to',
      required: false
    }
  ]
};

async function handler(args: Record<string, any>, context: ToolContext): Promise<PromptMessage[]> {
  const { docType, scope, projectPath } = args;
  const boundProjectPath = projectPath || context.workspacePath || context.projectPath;
  
  if (!docType) {
    throw new Error('docType is a required argument');
  }

  const validDocTypes = ['product', 'tech', 'structure'];
  if (!validDocTypes.includes(docType)) {
    throw new Error(`docType must be one of: ${validDocTypes.join(', ')}`);
  }

  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Create a ${docType} steering document for the project.

**Context:**
- Project: ${boundProjectPath}
- Steering document type: ${docType}
${scope ? `- Scope: ${scope}` : ''}
${context.dashboardUrl ? `- Dashboard: ${context.dashboardUrl}` : ''}

**Instructions:**
1. First, read the template at: .spec-workflow/templates/${docType}-template.md
2. Check if steering docs exist at: .spec-workflow/steering/
3. Create comprehensive content following the template structure
4. Create the document at: .spec-workflow/steering/${docType}.md
5. After creating, use approvals tool with action:'request' and projectPath "${boundProjectPath}" to get user approval

**File Paths:**
- Template location: .spec-workflow/templates/${docType}-template.md
- Document destination: .spec-workflow/steering/${docType}.md

**Steering Document Types:**
- **product**: Defines project vision, goals, and user outcomes
- **tech**: Documents technology decisions and architecture patterns
- **structure**: Maps codebase organization and conventions

**Key Principles:**
- Be specific and actionable
- Include examples where helpful
- Consider both technical and business requirements
- Provide clear guidance for future development
- Templates are automatically updated on server start

**Project Binding:**
- Treat projectPath as the workspace/worktree selector for all stateful spec-workflow tool calls
- Use projectPath "${boundProjectPath}" when calling approvals, spec-status, and log-implementation
- This is especially important when one shared MCP server serves multiple git worktrees

Please read the ${docType} template and create a comprehensive steering document at the specified path.`
      }
    }
  ];

  return messages;
}

export const createSteeringDocPrompt: PromptDefinition = {
  prompt,
  handler
};