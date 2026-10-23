import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { floorplanPdf } from './fixtures.mjs';

async function state(page: Page) {
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  return page.evaluate(() => JSON.parse(localStorage.getItem('planform-workspace-v1')!).plan);
}
async function clickWorld(page: Page, x: number, y: number) {
  const p = await page.getByTestId('plan-canvas').evaluate((svg, point) => { const p = new DOMPoint(point.x, point.y).matrixTransform((svg as unknown as SVGSVGElement).getScreenCTM()!); return { x: p.x, y: p.y }; }, { x, y });
  await page.mouse.click(p.x, p.y);
}
test('unlocks, accepts intermediate typing, applies precise dimensions and preserves them on reload', async ({ page }) => {
  await page.goto('/'); await expect(page.getByLabel('空間寬度')).toBeDisabled();
  await page.getByRole('button', { name: '解鎖調整', exact: true }).click();
  await page.getByLabel('空間寬度').fill('3'); expect((await state(page)).width).toBe(12);
  await page.getByLabel('空間寬度').fill('3.625'); await page.getByLabel('空間深度').fill('4.5');
  await page.getByRole('button', { name: '套用長寬' }).click();
  expect((await state(page)).width).toBe(3.625); expect((await state(page)).depth).toBe(4.5);
  await page.reload(); await expect(page.getByLabel('空間寬度')).toHaveValue('3.625');
  await page.getByRole('button', { name: '鎖定尺寸', exact: true }).click(); await expect(page.getByLabel('空間寬度')).toBeDisabled();
});

test('imports a PNG, calibrates a 3600 mm annotation, traces an exact wall and restores the drawing', async ({ page }) => {
  await page.goto('/');
  const base64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const ctx = c.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 600, 400); ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.strokeRect(50, 50, 500, 300); ctx.font = '22px sans-serif'; ctx.fillStyle = '#333'; ctx.fillText('3600 mm', 200, 35); return c.toDataURL('image/png').split(',')[1]; });
  await page.getByRole('button', { name: '匯入圖片／PDF 平面圖' }).click();
  await page.getByLabel('選擇平面圖檔案').setInputFiles({ name: 'measured-plan.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
  await expect(page.getByRole('img', { name: '匯入平面圖預覽' })).toBeVisible();
  await page.getByRole('button', { name: '匯入並校正比例' }).click();
  await expect(page.getByTestId('floorplan-underlay')).toBeVisible(); expect((await state(page)).walls).toHaveLength(0);
  await clickWorld(page, 1, 1); await clickWorld(page, 5, 1);
  await page.getByLabel('已知距離', { exact: true }).fill('3600'); await page.getByRole('button', { name: '套用標註尺寸' }).click();
  let p = await state(page); expect(p.underlay.width).toBeCloseTo(10.8, 2); expect(p.underlay.calibratedDistance).toBe(3.6);
  await page.getByRole('button', { name: '繪製隔間', exact: true }).click(); await clickWorld(page, 2, 2); await clickWorld(page, 6, 2); await page.keyboard.press('v'); await clickWorld(page, 4, 2);
  await page.getByLabel('精確牆長', { exact: true }).fill('3.125'); await page.getByRole('button', { name: '套用牆長' }).click();
  p = await state(page); expect(p.walls[0].b.x - p.walls[0].a.x).toBeCloseTo(3.125);
  await page.reload(); await expect(page.getByTestId('floorplan-underlay')).toBeVisible(); expect((await state(page)).underlay.calibratedDistance).toBe(3.6);
});

test('imports a multipage PDF and reads dimension labels from the selected page', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: '匯入圖片／PDF 平面圖' }).click();
  await page.getByLabel('選擇平面圖檔案').setInputFiles({ name: 'floorplans.pdf', mimeType: 'application/pdf', buffer: floorplanPdf() });
  await expect(page.getByRole('img', { name: '匯入平面圖預覽' })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.pdf-annotations')).toContainText('6000');
  await page.getByLabel('PDF 頁面', { exact: true }).selectOption('2');
  await expect(page.locator('.pdf-annotations')).toContainText('2500');
  await page.getByRole('button', { name: '匯入並校正比例' }).click();
  const p = await state(page); expect(p.underlay.name).toContain('第 2 頁'); expect(p.underlay.pixelWidth).toBeGreaterThan(500);
  expect(errors).toEqual([]);
});

test('rejects unreadable imports without altering the current plan', async ({ page }) => {
  await page.goto('/'); const before = await state(page);
  await page.getByRole('button', { name: '匯入圖片／PDF 平面圖' }).click();
  await page.getByLabel('選擇平面圖檔案').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByRole('alert')).toContainText('無法讀取圖片');
  await expect(page.getByRole('button', { name: '匯入並校正比例' })).toBeDisabled();
  await page.getByRole('button', { name: '關閉匯入平面圖' }).click(); expect((await state(page)).id).toBe(before.id);
});
