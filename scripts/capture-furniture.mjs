import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = relative => fileURLToPath(new URL(relative, import.meta.url));
const origin = new URL(process.env.PLANFORM_CAPTURE_URL || 'http://127.0.0.1:5173');
const captureURL = new URL('/__furniture-capture', origin).href;
const html = String.raw`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body><script type="module">
try {
  await Promise.all([
    import('/node_modules/@fontsource/noto-sans-tc/400.css?import'),
    import('/node_modules/@fontsource/noto-sans-tc/500.css?import'),
    import('/node_modules/@fontsource/noto-sans-tc/600.css?import'),
  ]);
  const source = await fetch('/src/furnitureMeshes.ts').then(response => response.text());
  const threeURL = source.match(/import \* as THREE from ["']([^"']+)["']/)?.[1];
  if (!threeURL) throw new Error('Furniture capture requires the Vite development server with source modules.');
  const THREE = await import(threeURL);
  const { buildFurnitureMesh } = await import('/src/furnitureMeshes.ts');
  const { createSceneMaterials } = await import('/src/sceneMaterials.ts');
  const { interiorStyles } = await import('/src/interiorStyles.ts');
  const { catalog } = await import('/src/furnitureCatalog.ts');
  const sceneSource = await fetch('/src/Scene3D.tsx').then(response => response.text());
  const environmentURL = sceneSource.match(/import \{ RoomEnvironment \} from ["']([^"']+)["']/)?.[1];
  if (!environmentURL) throw new Error('RoomEnvironment import was not found.');
  const { RoomEnvironment } = await import(environmentURL);
  const entries = Object.entries(catalog);
  if (entries.length !== 43) throw new Error('Update the furniture gallery title and validation for the changed catalog.');
  const title = '43 種家具・實際 3D 模型';
  const subtitle = '北歐風預設材質・常用尺寸（公分）・可逐件調整尺寸與外觀';
  const footnote = '尺寸為寬 × 深 × 設定高度；桌、檯面以主體高度為準，吊燈依層高懸掛。家具可切換整體風格或調整單件材質。';
  const text = title + subtitle + footnote + '0123456789.寬深高' + entries.map(([, spec]) => spec.name).join('');
  await Promise.all([400, 500, 600].map(weight => document.fonts.load(weight + ' 20px "Noto Sans TC"', text)));
  await document.fonts.ready;

  const style = interiorStyles.find(style => style.id === 'nordic');
  const pool = createSceneMaterials(style);
  const roles = ['wood', 'fabric', 'accent', 'metal', 'stone', 'ceramic', 'glass', 'dark', 'leaf', 'emissive', 'leather'];
  const materials = Object.fromEntries(roles.map(role => [role, pool.get(role)]));
  const cardWidth = 256, modelHeight = 192, captionHeight = 56, cardHeight = modelHeight + captionHeight;
  const columns = 7, gap = 12, margin = 28, header = 110, footer = 60;
  const rows = Math.ceil(entries.length / columns);
  const output = document.createElement('canvas');
  output.width = columns * cardWidth + (columns - 1) * gap + margin * 2;
  output.height = header + rows * cardHeight + (rows - 1) * gap + footer;
  const ctx = output.getContext('2d');
  ctx.fillStyle = '#f4f5ef'; ctx.fillRect(0, 0, output.width, output.height);
  ctx.textAlign = 'left'; ctx.fillStyle = '#3e5037'; ctx.font = '600 32px "Noto Sans TC", sans-serif';
  ctx.fillText(title, margin, 50);
  ctx.font = '400 17px "Noto Sans TC", sans-serif'; ctx.fillStyle = '#75826b';
  ctx.fillText(subtitle, margin, 83);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(cardWidth, modelHeight); renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.03;
  renderer.setClearColor('#f3f0e9', 1);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer), environment = new RoomEnvironment();
  const environmentMap = pmrem.fromScene(environment, .04);
  scene.environment = environmentMap.texture; scene.environmentIntensity = .42;
  environment.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(style.light, style.floor, .9));
  const light = new THREE.DirectionalLight(style.light, 2.7);
  light.position.set(-4, 7, 5); light.castShadow = true; light.shadow.mapSize.set(512, 512);
  Object.assign(light.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  light.shadow.normalBias = .018; scene.add(light);
  const fill = new THREE.DirectionalLight('#e7efff', .35); fill.position.set(5, 3, -5); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#f3f0e9', roughness: .9 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.025; ground.receiveShadow = true; scene.add(ground);
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .01, 100), stats = [];
  const cm = metres => String(Math.round(metres * 1000) / 10);
  try {
    for (let i = 0; i < entries.length; i++) {
      const [kind, spec] = entries[i];
      const model = buildFurnitureMesh({ id: kind, kind, x: 0, y: 0, w: spec.w, d: spec.d, h: spec.h, rotation: 0 }, style, { cutaway: false, roomHeight: 2.8, materials });
      scene.add(model.group); model.group.updateMatrixWorld(true);
      try {
        const bounds = new THREE.Box3().setFromObject(model.group), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
        const diagonal = Math.max(size.x, size.y, size.z, .2), aspect = cardWidth / modelHeight;
        camera.position.copy(center).add(new THREE.Vector3(diagonal * 1.1, diagonal * .9, diagonal * 1.5)); camera.lookAt(center);
        camera.left = -diagonal * .77 * aspect; camera.right = diagonal * .77 * aspect;
        camera.top = diagonal * .77; camera.bottom = -diagonal * .77; camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        const x = margin + i % columns * (cardWidth + gap), y = header + Math.floor(i / columns) * (cardHeight + gap);
        ctx.drawImage(renderer.domElement, x, y);
        ctx.fillStyle = '#fff'; ctx.fillRect(x, y + modelHeight, cardWidth, captionHeight);
        ctx.textAlign = 'center'; ctx.fillStyle = '#43553b'; ctx.font = '500 17px "Noto Sans TC", sans-serif';
        ctx.fillText(spec.name, x + cardWidth / 2, y + modelHeight + 24);
        ctx.fillStyle = '#7e8876'; ctx.font = '400 13px "Noto Sans TC", sans-serif';
        ctx.fillText('寬 ' + cm(spec.w) + ' × 深 ' + cm(spec.d) + ' × 高 ' + cm(spec.h), x + cardWidth / 2, y + modelHeight + 45);
        let meshes = 0, triangles = 0;
        model.group.traverse(object => { if (object.isMesh) { meshes++; triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3; } });
        const record = { kind, name: spec.name, meshes, drawCalls: renderer.info.render.calls, triangles: Math.round(triangles), width: size.x, depth: size.z, height: size.y, footprintOK: size.x <= spec.w + .0001 && size.z <= spec.d + .0001 };
        if (!meshes || !record.footprintOK) throw new Error('Furniture geometry validation failed: ' + JSON.stringify(record));
        stats.push(record);
      } finally { scene.remove(model.group); model.dispose(); }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    ctx.textAlign = 'left'; ctx.fillStyle = '#75826b'; ctx.font = '400 15px "Noto Sans TC", sans-serif';
    ctx.fillText(footnote, margin, output.height - 24);
    window.captureResult = { png: output.toDataURL('image/png'), stats };
  } finally {
    pool.dispose(); environmentMap.dispose(); ground.geometry.dispose(); ground.material.dispose();
    light.shadow.map?.dispose(); renderer.dispose();
  }
} catch (error) { window.captureError = String(error.stack || error); }
window.captureDone = true;
</script></body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(captureURL, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(captureURL);
  await page.waitForFunction(() => window.captureDone, undefined, { timeout: 180000 });
  const result = await page.evaluate(() => ({ error: window.captureError, result: window.captureResult }));
  if (result.error) throw new Error(result.error);
  if (errors.length) throw new Error(errors.join('\n'));
  await mkdir(file('../downloads'), { recursive: true }); await mkdir(file('../test-results'), { recursive: true });
  await writeFile(file('../downloads/furniture-v3-library.png'), Buffer.from(result.result.png.split(',')[1], 'base64'));
  await writeFile(file('../test-results/furniture-v3-model-stats.json'), JSON.stringify(result.result.stats, null, 2));
  console.log('Captured and validated ' + result.result.stats.length + ' actual furniture models: downloads/furniture-v3-library.png');
} finally { await browser.close(); }
