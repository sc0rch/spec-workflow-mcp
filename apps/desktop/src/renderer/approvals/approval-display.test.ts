import { describe, expect, it } from 'vitest';
import { getApprovalDisplayTitle } from './approval-display.js';

describe('getApprovalDisplayTitle', () => {
  it('shortens verbose approve titles for review surfaces', () => {
    expect(
      getApprovalDisplayTitle({
        title: 'Approve requirements for Api Layer Service Test Coverage'
      })
    ).toBe('Requirements · Api Layer Service Test Coverage');
  });

  it('leaves non-approve titles unchanged', () => {
    expect(
      getApprovalDisplayTitle({
        title: 'Review desktop shell'
      })
    ).toBe('Review desktop shell');
  });
});
