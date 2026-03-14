import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'path';

test('opens the desktop shell smoke screen', async () => {
  const app = await electron.launch({
    args: [join(process.cwd(), 'dist', 'main', 'index.js')]
  });

  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'Spec Workflow Desktop' })).toBeVisible();
  await expect(page.getByText(/native shell capabilities are now wired through electron/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose project folder' })).toBeVisible();

  await app.close();
});
