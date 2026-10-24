import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

type ContextWindow = Window & { __stylePreviewContexts: number };
const state = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('planform-workspace-v1')!).plan);

test('renders ten real style samples through one cached WebGL renderer', async ({ page }) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext, canvases = new WeakSet();
    (window as ContextWindow).__stylePreviewContexts = 0;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      const context = Reflect.apply(original, this, [type, ...args]);
      if (type.startsWith('webgl') && context && !canvases.has(this)) { canvases.add(this); (window as ContextWindow).__stylePreviewContexts++; }
      return context;
    } as typeof original;
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.getByRole('button', { name: '選擇室內風格', exact: true }).click();
  await expect(page.locator('.style-choice')).toHaveCount(10);
  await expect(page.locator('.style-render-preview img')).toHaveCount(10, { timeout: 150000 });
  const samples = await page.locator('.style-render-preview img').evaluateAll(images => images.map(img => (img as HTMLImageElement).src));
  const hashes = samples.map(src => createHash('sha256').update(src).digest('hex'));
  expect(new Set(hashes).size).toBe(10); expect(samples.every(src => src.startsWith('data:image/png;base64,'))).toBe(true);
  const contexts = await page.evaluate(() => (window as ContextWindow).__stylePreviewContexts); expect(contexts).toBe(1);
  await page.getByRole('button', { name: '關閉風格選擇', exact: true }).click();
  await page.getByRole('button', { name: '選擇室內風格', exact: true }).click();
  await expect(page.locator('.style-render-preview img')).toHaveCount(10);
  expect(await page.evaluate(() => (window as ContextWindow).__stylePreviewContexts)).toBe(contexts);
  expect(errors).toEqual([]);
});

test('applies style geometry while preserving the floor plan and offers closer camera views', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.getByRole('button', { name: '載入你提供的三房兩衛範例', exact: true }).click();
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible({ timeout: 30000 });
  const before = await state(page);
  await page.getByRole('button', { name: '選擇室內風格', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /INDUSTRIAL/ }).click();
  await expect(page.locator('.scene-style-label')).toContainText('工業風');
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible({ timeout: 30000 });
  const after = await state(page); expect(after.style).toBe('industrial');
  for (const key of ['walls', 'furniture', 'columns', 'excludedAreas', 'outline', 'width', 'depth']) expect(after[key]).toEqual(before[key]);
  const canvas = page.getByTestId('scene-3d').locator('canvas'), whole = await canvas.screenshot();
  await page.getByRole('button', { name: '客廳細節', exact: true }).click();
  await expect(page.getByRole('button', { name: '客廳細節', exact: true })).toHaveClass(/active/);
  expect((await canvas.screenshot()).equals(whole)).toBe(false);
  await page.getByRole('button', { name: '主臥細節', exact: true }).click();
  await expect(page.getByRole('button', { name: '主臥細節', exact: true })).toHaveClass(/active/);
  await page.getByRole('button', { name: '俯視格局', exact: true }).click();
  await expect(page.getByRole('button', { name: '俯視格局', exact: true })).toHaveClass(/active/);
  expect(await state(page)).toEqual(after); expect(errors).toEqual([]);
});
