import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { interiorStyles } from '../src/interiorStyles';

async function state(page: Page) {
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  return page.evaluate(() => JSON.parse(localStorage.getItem('planform-workspace-v1')!).plan);
}

test('rebuilds the supplied plan with editable furniture, ten actual 3D styles and PNG export', async ({ page }) => {
  test.setTimeout(150000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: '載入你提供的三房兩衛範例' }).click();
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();
  const original = await state(page); expect(original.reconstruction.method).toBe('reference'); expect(original.depth).toBe(10.67); expect(original.furniture.length).toBeGreaterThan(14);
  const images: Record<string, Buffer> = {};
  for (const style of interiorStyles) {
    await page.getByRole('button', { name: '選擇室內風格' }).click();
    await expect(page.locator('.style-choice')).toHaveCount(10);
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(style.english) }).click();
    await expect(page.locator('.scene-style-label')).toContainText(style.name);
    await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();
    const p = await state(page); expect(p.style).toBe(style.id); expect(p.walls).toEqual(original.walls); expect(p.furniture).toEqual(original.furniture);
    if (style.id === 'nordic' || style.id === 'industrial') { images[style.id] = await page.getByTestId('scene-3d').locator('canvas').screenshot(); await page.screenshot({ path: `test-results/reference-${style.id}.png` }); }
  }
  expect(images.nordic.equals(images.industrial)).toBe(false);
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: '匯出 3D PNG' }).click();
  const download = await downloading, png = await readFile((await download.path())!);
  expect(download.suggestedFilename()).toContain('地中海風'); expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); expect(png.length).toBeGreaterThan(10000);
  await page.getByRole('button', { name: '2D 平面設計' }).click(); await page.getByRole('button', { name: '家具', exact: true }).click(); await page.getByRole('button', { name: '單人椅' }).click();
  expect((await state(page)).furniture.length).toBe(original.furniture.length + 1);
  await page.reload(); expect((await state(page)).style).toBe('mediterranean'); expect((await state(page)).furniture.length).toBe(original.furniture.length + 1);
  expect(errors).toEqual([]);
});

test('reconstructs walls from an imported image instead of applying a generic template', async ({ page }) => {
  const base64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const ctx = c.getContext('2d')!; ctx.fillStyle = '#e0ded6'; ctx.fillRect(0, 0, 600, 400); ctx.strokeStyle = '#222'; ctx.lineWidth = 8; ctx.strokeRect(40, 40, 520, 320); ctx.beginPath(); ctx.moveTo(300, 40); ctx.lineTo(300, 360); ctx.moveTo(40, 200); ctx.lineTo(560, 200); ctx.stroke(); return c.toDataURL('image/png').split(',')[1]; });
  await page.goto('/'); await page.getByRole('button', { name: '匯入原圖並重建' }).click();
  await page.getByLabel('選擇平面圖檔案').setInputFiles({ name: 'four-rooms.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
  await expect(page.getByTestId('crop-preview')).toBeVisible();
  await page.getByLabel('重建主體總寬', { exact: true }).fill('900'); await page.getByLabel('重建主體總深', { exact: true }).fill('600');
  await page.getByRole('checkbox', { name: /我已依原圖核對/ }).check(); await page.getByRole('button', { name: '辨識牆面並配置家具' }).click();
  await expect(page.getByTestId('reconstruction-preview')).toBeVisible(); await page.getByRole('button', { name: '套用重建並開啟 3D' }).click();
  const p = await state(page); expect(p.width).toBe(9); expect(p.depth).toBe(6); expect(p.reconstruction.method).toBe('image-lines'); expect(p.reconstruction.needsReview).toBe(true);
  expect(p.walls.some((w: { a: { x: number }; b: { x: number } }) => Math.abs(w.a.x - 4.5) < .15 && Math.abs(w.b.x - 4.5) < .15)).toBe(true);
  expect(p.rooms.length).toBeGreaterThanOrEqual(3); expect(p.furniture.length).toBeGreaterThan(3);
  expect(p.underlay.calibratedDistance).toBe(9);
  await page.getByRole('button', { name: '2D 平面設計' }).click();
  await page.getByRole('button', { name: '解鎖調整', exact: true }).click();
  await page.getByLabel('空間寬度', { exact: true }).fill('10');
  await page.getByRole('button', { name: '套用長寬', exact: true }).click();
  const resized = await state(page);
  expect(resized.width).toBe(10); expect(resized.underlay.width).toBe(9); expect(resized.underlay.height).toBe(6);
  expect(resized.underlay.calibratedDistance).toBe(9);
});

test('does not fabricate a layout when the imported image has no usable wall lines', async ({ page }) => {
  await page.goto('/'); const original = await state(page);
  const blank = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const ctx = c.getContext('2d')!; ctx.fillStyle = '#ddd'; ctx.fillRect(0, 0, 600, 400); return c.toDataURL('image/png').split(',')[1]; });
  await page.getByRole('button', { name: '匯入原圖並重建' }).click(); await page.getByLabel('選擇平面圖檔案').setInputFiles({ name: 'blank.png', mimeType: 'image/png', buffer: Buffer.from(blank, 'base64') });
  await expect(page.getByTestId('crop-preview')).toBeVisible(); await page.getByLabel('重建主體總寬', { exact: true }).fill('900'); await page.getByLabel('重建主體總深', { exact: true }).fill('600'); await page.getByRole('checkbox', { name: /我已依原圖核對/ }).check(); await page.getByRole('button', { name: '辨識牆面並配置家具' }).click();
  await expect(page.getByRole('alert')).toContainText('尚未找到足夠的牆線'); expect((await state(page)).id).toBe(original.id);
});
