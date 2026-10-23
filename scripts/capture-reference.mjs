import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = relative => fileURLToPath(new URL(relative, import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  await mkdir(file('../test-results'), { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1280 }, deviceScaleFactor: 1.5 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.PLANFORM_CAPTURE_URL || 'http://127.0.0.1:5173');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: '載入你提供的三房兩衛範例' }).click();
  await page.getByTestId('scene-3d').locator('canvas').waitFor();
  await page.waitForTimeout(1200);
  const exporting = page.waitForEvent('download'); await page.getByRole('button', { name: '匯出 3D PNG' }).click();
  const png = await exporting; await writeFile(file('../downloads/reference-preview.png'), await readFile(await png.path()));
  await page.screenshot({ path: file('../test-results/reference-v2-workspace.png') });
  await page.getByRole('button', { name: '2D 平面設計' }).click();
  await page.screenshot({ path: file('../test-results/reference-v2-2d.png') });
  await page.getByRole('button', { name: '匯出圖面' }).click();
  const exportingSVG = page.waitForEvent('download'); await page.getByRole('button', { name: /SVG 向量平面圖/ }).click();
  const svg = await exportingSVG; await writeFile(file('../downloads/reference-plan.svg'), await readFile(await svg.path()));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Captured the current reference model PNG and SVG; review their geometry before packaging.');
} finally { await browser.close(); }
