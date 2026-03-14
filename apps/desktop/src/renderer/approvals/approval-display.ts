interface ApprovalTitleSource {
  readonly title: string;
}

export function getApprovalDisplayTitle(approval: ApprovalTitleSource): string {
  const match = approval.title.match(/^Approve\s+(.+?)\s+for\s+(.+)$/i);
  if (!match) {
    return approval.title;
  }

  const phase = match[1]?.replace(/\bspec\b/gi, '').trim();
  const target = match[2]?.trim();
  if (!phase || !target) {
    return approval.title;
  }

  return `${formatDisplayName(phase)} · ${target}`;
}

function formatDisplayName(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}
