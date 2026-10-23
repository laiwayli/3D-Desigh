import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function state(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('.save-status')).toContainText('已儲存');
  return page.evaluate(() => JSON.parse(localStorage.getItem('planform-workspace-v1')!));
}
async function canvasPoint(page: Page, x: number, y: number) {
  return page.getByTestId('plan-canvas').evaluate((svg, p) => {
    const q = new DOMPoint(p.x, p.y).matrixTransform((svg as unknown as SVGSVGElement).getScreenCTM()!); return { x: q.x, y: q.y };
  }, { x, y });
}

test('draws a wall, changes thickness, and supports undo and redo', async ({ page }) => {
  await page.goto('/');
  const before = await state(page);
  await page.getByRole('button', { name: '繪製隔間', exact: true }).click();
  const a = await canvasPoint(page, 4.5, 3.3), b = await canvasPoint(page, 6.6, 3.3);
  await page.mouse.click(a.x, a.y); await page.mouse.move(b.x, b.y); await page.mouse.click(b.x, b.y);
  expect((await state(page)).plan.walls).toHaveLength(before.plan.walls.length + 1);
  await page.getByRole('button', { name: '復原', exact: true }).click();
  expect((await state(page)).plan.walls).toHaveLength(before.plan.walls.length);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  expect((await state(page)).plan.walls).toHaveLength(before.plan.walls.length + 1);
  await page.keyboard.press('v');
  await page.mouse.click((a.x + b.x) / 2, a.y);
  await page.getByRole('spinbutton', { name: '選取牆面厚度' }).fill('18');
  expect((await state(page)).plan.walls.at(-1).thickness).toBe(.18);
  const mid = await canvasPoint(page, 5.55, 3.3), moved = await canvasPoint(page, 5.55, 3.9);
  await page.mouse.move(mid.x, mid.y); await page.mouse.down(); await page.mouse.move(moved.x, moved.y, { steps: 5 }); await page.mouse.up();
  expect((await state(page)).plan.walls.at(-1).a.y).toBeCloseTo(3.9);
  const endpoint = await canvasPoint(page, 6.6, 3.9), extended = await canvasPoint(page, 6.9, 3.9);
  await page.mouse.move(endpoint.x, endpoint.y); await page.mouse.down(); await page.mouse.move(extended.x, extended.y, { steps: 5 }); await page.mouse.up();
  expect((await state(page)).plan.walls.at(-1).b.x).toBeCloseTo(6.9);
  await page.getByRole('button', { name: '刪除物件' }).click();
  expect((await state(page)).plan.walls).toHaveLength(before.plan.walls.length);
});

test('adds, drags, rotates, resizes and deletes CAD furniture', async ({ page }) => {
  await page.goto('/'); const before = await state(page);
  await page.getByRole('button', { name: '家具', exact: true }).click();
  await page.getByRole('button', { name: '三人沙發' }).click();
  let s = await state(page); expect(s.plan.furniture).toHaveLength(before.plan.furniture.length + 1);
  const f = s.plan.furniture.at(-1), from = await canvasPoint(page, f.x, f.y), to = await canvasPoint(page, 5.3, 3.4);
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up();
  s = await state(page); expect(s.plan.furniture.at(-1).x).toBeCloseTo(5.3); expect(s.plan.furniture.at(-1).y).toBeCloseTo(3.4);
  await page.keyboard.press('r'); expect((await state(page)).plan.furniture.at(-1).rotation).toBe(90);
  await page.getByRole('spinbutton', { name: '家具寬度', exact: true }).fill('2.2');
  expect((await state(page)).plan.furniture.at(-1).w).toBe(2.2);
  await page.getByRole('button', { name: '刪除物件' }).click();
  expect((await state(page)).plan.furniture).toHaveLength(before.plan.furniture.length);
});

test('generates for a new entrance, preserves the shell, saves and reloads a proposal', async ({ page }) => {
  await page.goto('/'); const before = await state(page);
  await page.getByRole('button', { name: '生成配置方案' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '右側', exact: true }).click();
  await page.getByRole('button', { name: /靜謐・居家辦公/ }).click();
  await page.getByRole('button', { name: '套用此配置' }).click();
  let s = await state(page);
  expect(s.plan.entry).toBe('right'); expect(s.plan.width).toBe(before.plan.width); expect(s.plan.depth).toBe(before.plan.depth); expect(s.plan.name).toBe('靜謐・居家辦公');
  await page.getByRole('button', { name: '儲存方案', exact: true }).click();
  s = await state(page); expect(s.saved).toHaveLength(1);
  await page.reload(); s = await state(page); expect(s.plan.entry).toBe('right'); expect(s.saved).toHaveLength(1);
  await page.locator('.sidebar-tabs').getByRole('button', { name: /^方案/ }).click();
  await expect(page.locator('.saved-card')).toHaveCount(1);
});

test('exports vector SVG and restores a JSON backup', async ({ page }) => {
  await page.goto('/');
  for (const [name, ext] of [['SVG 向量平面圖', '.svg'], ['JSON 專案資料', '.json']]) {
    await page.getByRole('button', { name: '匯出圖面' }).click();
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: new RegExp(name) }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(new RegExp(`${ext}$`));
    const content = await readFile((await file.path())!, 'utf8');
    if (ext === '.svg') { expect(content).toContain('<svg'); expect(content).toContain('pattern'); }
    else {
      const data = JSON.parse(content); expect(data.format).toBe('planform'); expect(data.plan.walls.length).toBeGreaterThan(0);
      data.project = '備份還原測試';
      await page.getByLabel('匯入 JSON 專案').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
      await expect(page.getByRole('textbox', { name: '專案名稱' })).toHaveValue('備份還原測試');
    }
  }
});

test('renders a live WebGL 3D model with no application errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: /3D 空間預覽/ }).click();
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();
  const result = await page.getByTestId('scene-3d').locator('canvas').evaluate((el: HTMLCanvasElement) => { const gl = el.getContext('webgl2'); return { width: el.width, height: el.height, renderer: gl?.getParameter(gl.VERSION) }; });
  expect(result.width).toBeGreaterThan(300); expect(result.height).toBeGreaterThan(300); expect(result.renderer).toContain('WebGL');
  await page.waitForTimeout(500); await page.screenshot({ path: 'test-results/3d-desktop.png' });
  await page.getByRole('button', { name: '2D 平面設計' }).click(); await expect(page.getByTestId('plan-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('provides usable tools and generation on a mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.getByTestId('plan-canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '開啟工具面板' }).click();
  await page.getByRole('button', { name: '生成配置方案' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '套用此配置' }).click();
  await expect(page.locator('.left-sidebar')).not.toBeVisible();
  await page.screenshot({ path: 'test-results/mobile.png' });
});
