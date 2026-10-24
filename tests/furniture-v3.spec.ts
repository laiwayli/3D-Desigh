import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { catalog, furnitureVariants } from '../src/furnitureCatalog';

async function plan(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return page.evaluate(() => JSON.parse(localStorage.getItem('planform-workspace-v1')!).plan);
}

test('offers 43 furniture types with search, categories and exact variant dimensions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '家具', exact: true }).click();
  const library = page.getByRole('region', { name: '家具圖塊庫', exact: true });
  await expect(library.locator('.furniture-library-card')).toHaveCount(43);
  await expect(library.getByRole('status')).toContainText('98 個尺寸款式');
  await library.getByLabel('搜尋家具').fill('沒有這個家具');
  await expect(library.locator('.furniture-library-card')).toHaveCount(0);
  await expect(library).toContainText('找不到符合的家具');
  await library.getByRole('button', { name: '顯示所有家具', exact: true }).click();
  await expect(library.locator('.furniture-library-card')).toHaveCount(43);
  await library.getByRole('button', { name: '書房', exact: true }).click();
  await library.getByLabel('搜尋家具').fill('WFH');
  await expect(library.locator('.furniture-library-card')).toHaveCount(3);
  await expect(library.getByRole('button', { name: 'L 型沙發', exact: true })).toHaveCount(0);
  const variant = furnitureVariants.find(v => v.id === 'doubleDesk-wide')!;
  await library.getByLabel('雙人工作桌尺寸款式').selectOption(variant.id);
  await expect(library.locator('[data-furniture-kind="doubleDesk"].furniture-library-card')).toContainText('240 × 70 × 75');
  const initial = await plan(page);
  await library.getByRole('button', { name: '雙人工作桌', exact: true }).click();
  const next = await plan(page), item = next.furniture.at(-1);
  expect(next.furniture).toHaveLength(initial.furniture.length + 1);
  expect(item).toMatchObject({ assetId: variant.id, kind: variant.kind, w: variant.w, d: variant.d, h: variant.h });
  await expect(page.getByLabel('家具寬度', { exact: true })).toHaveValue('2.4');
  await expect(page.getByLabel('家具深度', { exact: true })).toHaveValue('0.7');
  await expect(page.getByLabel('家具高度', { exact: true })).toHaveValue('0.75');

  await library.getByRole('button', { name: '全部', exact: true }).click();
  await library.getByLabel('搜尋家具').fill('窗簾');
  await library.getByRole('button', { name: '窗簾', exact: true }).click();
  const curtain = (await plan(page)).furniture.at(-1);
  const depth = page.getByLabel('家具深度', { exact: true });
  await expect(depth).toHaveValue('0.12');
  await depth.fill('0.14');
  expect((await plan(page)).furniture.find((item: { id: string }) => item.id === curtain.id).d).toBe(.14);
  await depth.fill('0.12');
  expect((await plan(page)).furniture.find((item: { id: string }) => item.id === curtain.id).d).toBe(.12);
});

test('preserves individual height, finish and colour through reload, JSON and 3D rendering', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '家具', exact: true }).click();
  const library = page.getByRole('region', { name: '家具圖塊庫', exact: true });
  await library.getByLabel('搜尋家具').fill('書櫃');
  await library.getByLabel('書櫃尺寸款式').selectOption('bookshelf-compact');
  await library.getByRole('button', { name: catalog.bookshelf.name, exact: true }).click();
  const itemId = (await plan(page)).furniture.at(-1).id;
  await page.getByLabel('家具高度', { exact: true }).fill('1.65');
  await page.getByLabel('家具表面材質', { exact: true }).selectOption('wood');
  await page.getByLabel('家具主色', { exact: true }).fill('#486d87');
  const expected = { id: itemId, assetId: 'bookshelf-compact', w: .6, d: .3, h: 1.65, finish: 'wood', color: '#486d87' };
  expect((await plan(page)).furniture.find((item: { id: string }) => item.id === itemId)).toMatchObject(expected);
  await page.getByRole('button', { name: /3D 空間預覽/ }).click();
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();
  await page.getByTestId('scene-3d').locator('canvas').screenshot({ path: 'test-results/furniture-v3-custom.png' });
  await page.reload();
  expect((await plan(page)).furniture.find((item: { id: string }) => item.id === itemId)).toMatchObject(expected);
  await page.getByRole('button', { name: '匯出圖面' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /JSON 專案資料/ }).click();
  const downloaded = await downloading;
  const json = JSON.parse(await readFile((await downloaded.path())!, 'utf8'));
  expect(json.plan.furniture.find((item: { id: string }) => item.id === itemId)).toMatchObject(expected);
  expect(errors).toEqual([]);
});
