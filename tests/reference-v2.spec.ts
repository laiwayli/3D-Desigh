import { test, expect } from '@playwright/test';

test('reviews the same-house mapping and changes furnishing without losing structural masks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '載入你提供的三房兩衛範例' }).click();
  await expect(page.getByTestId('reference-review')).toBeVisible();
  await expect(page.getByTestId('reference-review')).toContainText('臥室（一）');
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('planform-workspace-v1')!).plan);
  const before = await snapshot();
  expect(before.width).toBe(7.76); expect(before.columns).toHaveLength(2); expect(before.excludedAreas).toHaveLength(1);
  await page.getByRole('button', { name: '2D 平面設計' }).click();
  await expect(page.getByTestId('plan-canvas').locator('[data-testid="structural-column"]')).toHaveCount(2);
  await expect(page.getByTestId('plan-canvas').locator('[data-testid="excluded-area"]')).toHaveCount(1);
  await page.locator('.room-review-details > summary').click();
  await page.getByLabel('小孩房（上下舖）家具方案', { exact: true }).selectOption('');
  await page.getByRole('button', { name: '依空間用途重新配置家具', exact: true }).click();
  await expect.poll(async () => (await snapshot()).furniture.filter((f: {kind: string}) => f.kind === 'bunkBed').length).toBe(0);
  const after = await snapshot();
  expect(after.furniture.filter((f: {kind: string}) => f.kind === 'bed')).toHaveLength(2);
  expect(after.walls).toEqual(before.walls); expect(after.columns).toEqual(before.columns); expect(after.excludedAreas).toEqual(before.excludedAreas);
  expect(after.rooms.find((r: {sourceName?: string}) => r.sourceName === '臥室（一）').sourceName).toBe('臥室（一）');
  await page.reload(); expect((await snapshot()).columns).toEqual(before.columns);
});
