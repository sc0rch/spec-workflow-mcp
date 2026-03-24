import { inspect } from 'util';
import type { CommandResult } from '../types.js';

export function renderCommandResult(result: CommandResult, asJson: boolean): string {
  if (asJson) {
    return JSON.stringify(result, null, 2);
  }

  const guide = getGuide(result);
  if (guide) {
    return guide;
  }

  const lines = [result.message];

  if (result.projectContext) {
    lines.push('');
    lines.push(`Project: ${result.projectContext.projectPath}`);
    lines.push(`Workflow root: ${result.projectContext.workflowRoot}`);
  }

  if (result.data !== undefined) {
    lines.push('');
    lines.push('Data:');
    lines.push(inspect(result.data, { depth: null, colors: false, compact: false }));
  }

  if (result.nextSteps?.length) {
    lines.push('');
    lines.push('Next steps:');
    for (const step of result.nextSteps) {
      lines.push(`- ${step}`);
    }
  }

  return lines.join('\n');
}

function getGuide(result: CommandResult): string | null {
  if (
    typeof result.data === 'object'
    && result.data !== null
    && 'guide' in result.data
    && typeof (result.data as { guide?: unknown }).guide === 'string'
  ) {
    return (result.data as { guide: string }).guide;
  }

  return null;
}
