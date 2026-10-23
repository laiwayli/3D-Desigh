import { expect, test } from '@playwright/test';

test('starts dimensions empty, rotates pixels, and reviews candidates over their source', async ({ page }) => {
  await page.goto('/');
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 400;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 600, 400);
    ctx.fillStyle = '#ff0000'; ctx.fillRect(5, 5, 20, 20);
    ctx.strokeStyle = '#222'; ctx.lineWidth = 8; ctx.strokeRect(40, 40, 520, 320);
    ctx.beginPath(); ctx.moveTo(300, 40); ctx.lineTo(300, 360); ctx.moveTo(40, 200); ctx.lineTo(560, 200); ctx.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: '匯入原圖並重建' }).click();
  await page.getByLabel('選擇平面圖檔案').setInputFiles({ name: 'review-plan.png', mimeType: 'image/png', buffer: Buffer.from(source, 'base64') });
  await expect(page.getByLabel('重建主體總寬', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('重建主體總深', { exact: true })).toHaveValue('');
  await expect(page.getByRole('checkbox', { name: /我已依原圖核對/ })).toBeDisabled();
  await page.getByLabel('重建主體總寬', { exact: true }).fill('900');
  await page.getByLabel('重建主體總深', { exact: true }).fill('600');
  await page.getByRole('checkbox', { name: /我已依原圖核對/ }).check();
  await page.getByRole('button', { name: '向右旋轉 90°' }).click();
  await expect(page.getByRole('dialog')).toContainText('400 × 600 px');
  await expect(page.getByLabel('重建主體總寬', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('重建主體總深', { exact: true })).toHaveValue('');
  await expect(page.getByRole('checkbox', { name: /我已依原圖核對/ })).not.toBeChecked();
  const rotated = await page.getByTestId('crop-preview').locator('image').getAttribute('href');
  const pixel = await page.evaluate(async src => {
    const image = new Image(); image.src = src!; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    return [...ctx.getImageData(385, 15, 1, 1).data];
  }, rotated);
  expect(pixel[0]).toBeGreaterThan(pixel[1] * 2);
  await page.getByLabel('重建主體總寬', { exact: true }).fill('600');
  await page.getByLabel('重建主體總深', { exact: true }).fill('900');
  await page.getByRole('checkbox', { name: /我已依原圖核對/ }).check();
  await page.getByRole('button', { name: '辨識牆面並配置家具' }).click();
  await expect(page.getByTestId('reconstruction-source')).toBeVisible();
  await expect(page.getByTestId('candidate-wall-overlay')).toBeVisible();
  await expect(page.getByTestId('reconstruction-preview')).toHaveAttribute('viewBox', '0 0 6 9');
  const lines = await page.getByTestId('candidate-wall-overlay').locator('line').evaluateAll(nodes => nodes.map(n => ['x1', 'y1', 'x2', 'y2'].map(k => Number(n.getAttribute(k)))));
  expect(lines.some(([x1, , x2]) => Math.abs(x1 - 3) < .1 && Math.abs(x2 - 3) < .1)).toBe(true);
  expect(lines.some(([, y1, , y2]) => Math.abs(y1 - 4.5) < .1 && Math.abs(y2 - 4.5) < .1)).toBe(true);
  await expect(page.getByRole('status')).toContainText('線條摘要');
  await page.getByRole('checkbox', { name: /顯示候選牆線/ }).uncheck();
  await expect(page.getByTestId('candidate-wall-overlay')).toHaveCount(0);
  await expect(page.getByTestId('reconstruction-source')).toBeVisible();
  await page.getByRole('button', { name: '家具草稿', exact: true }).click();
  await expect(page.getByTestId('reconstruction-preview')).toBeVisible();
  await page.getByRole('button', { name: '原圖疊牆', exact: true }).click();
  await expect(page.getByTestId('reconstruction-source')).toBeVisible();
});

test('rejects dense imported linework without applying a fabricated layout', async ({ page }) => {
  await page.goto('/');
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('planform-workspace-v1')!).plan.id);
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 400;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 600, 400);
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 30; x <= 570; x += 16) { ctx.moveTo(x, 30); ctx.lineTo(x, 370); }
    for (let y = 30; y <= 370; y += 16) { ctx.moveTo(30, y); ctx.lineTo(570, y); }
    ctx.stroke(); return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: '匯入原圖並重建' }).click();
  await page.getByLabel('選擇平面圖檔案').setInputFiles({ name: 'dense-lines.png', mimeType: 'image/png', buffer: Buffer.from(source, 'base64') });
  await page.getByLabel('重建主體總寬', { exact: true }).fill('900');
  await page.getByLabel('重建主體總深', { exact: true }).fill('600');
  await page.getByRole('checkbox', { name: /我已依原圖核對/ }).check();
  await page.getByRole('button', { name: '辨識牆面並配置家具' }).click();
  await expect(page.getByRole('alert')).toContainText('候選線過於密集');
  await expect(page.getByTestId('reconstruction-preview')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('planform-workspace-v1')!).plan.id)).toBe(original);
});
