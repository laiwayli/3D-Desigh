import { useEffect, useState } from 'react';
import { Box, LoaderCircle } from 'lucide-react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { interiorStyles } from './interiorStyles';
import type { InteriorStyle, StyleId } from './interiorStyles';
import type { Furniture, FurnitureKind } from './model';
import { buildFurnitureMesh } from './furnitureMeshes';
import type { FurnitureMaterialSet } from './furnitureMeshes';
import { createSceneMaterials } from './sceneMaterials';

// Ten static views share one temporary renderer. No hidden per-card WebGL contexts.
const cache: Partial<Record<StyleId, string>> = {};
const listeners = new Set<() => void>();
let activeJob: { cancelled: boolean } | undefined;
let unavailable = false;
const publish = () => listeners.forEach(listener => listener());
const pause = () => new Promise<void>(resolve => window.setTimeout(resolve, 0));

function renderSampleRoom(renderer: THREE.WebGLRenderer, environment: THREE.Texture, style: InteriorStyle) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(style.background); scene.environment = environment; scene.environmentIntensity = .35;
  const surfaces = createSceneMaterials(style), geometries: THREE.BufferGeometry[] = [], furnitureDisposers: (() => void)[] = [];
  const materials: FurnitureMaterialSet & { leather?: THREE.Material } = { leather: surfaces.get('leather'), wood: surfaces.get('wood'), fabric: surfaces.get('fabric'), accent: surfaces.get('accent'), metal: surfaces.get('metal'), stone: surfaces.get('stone'), ceramic: surfaces.get('ceramic'), glass: surfaces.get('glass'), dark: surfaces.get('dark'), leaf: surfaces.get('leaf'), emissive: surfaces.get('emissive') };
  const block = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
    const geometry = new THREE.BoxGeometry(w, h, d); geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
  };
  const floor = surfaces.get('floor');
  if (floor.map) floor.map.repeat.set(3.6, 2.8);
  if (floor.normalMap) floor.normalMap.repeat.set(3.6, 2.8);
  block(6.2, .12, 4.8, 0, -.06, 0, floor);
  block(6.2, 2.2, .09, 0, 1.1, -2.4, surfaces.get('plaster'));
  block(.09, 2.2, 4.8, -3.1, 1.1, 0, surfaces.get('plaster'));
  for (const z of [-2.34]) block(6.1, .09, .025, 0, .045, z, surfaces.get('wood'));
  block(.025, .09, 4.7, -3.04, .045, 0, surfaces.get('wood'));

  const add = (kind: FurnitureKind, x: number, y: number, w: number, d: number, rotation = 0, h?: number) => {
    const item: Furniture = { id: `style-sample-${kind}`, kind, x: 0, y: 0, w, d, rotation: 0, ...(h === undefined ? {} : { h }) };
    const built = buildFurnitureMesh(item, style, { cutaway: false, roomHeight: 2.55, materials, mergeParts: true });
    built.group.position.set(x, 0, y); built.group.rotation.y = -rotation * Math.PI / 180; scene.add(built.group); furnitureDisposers.push(built.dispose);
  };
  // The exact same footprints and camera are used for every style.
  add('rug', -.05, .12, 3.65, 2.5);
  add('sofa', -.38, -1.42, 2.75, .98);
  add('coffeeTable', -.34, .12, 1.25, .72);
  add('armchair', 1.84, .64, .88, .9, -28);
  add('sideTable', -2.09, -1.18, .48, .48);
  add('sideboard', -2.75, .15, 1.62, .42, 90);
  add('floorLamp', 1.75, -1.8, .48, .48);
  add('plant', -2.16, 1.52, .55, .55);

  const fill = new THREE.HemisphereLight(style.light, style.floor, .65); scene.add(fill);
  const key = new THREE.DirectionalLight(style.light, 2.5); key.position.set(1.7, 6.6, 5.2); key.castShadow = true;
  key.shadow.mapSize.set(512, 512); key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.camera.near = .1; key.shadow.camera.far = 18; key.shadow.normalBias = .025; key.shadow.bias = -.0002; key.shadow.radius = 4; scene.add(key);
  const bounce = new THREE.DirectionalLight('#f5f7ff', .45); bounce.position.set(-2, 3, 1); scene.add(bounce);
  const camera = new THREE.PerspectiveCamera(37, 1.5, .1, 40); camera.position.set(6.2, 4.3, 6.8); camera.lookAt(-.1, .6, -.2);
  try {
    renderer.toneMappingExposure = 1.04; renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    furnitureDisposers.forEach(dispose => dispose()); geometries.forEach(geometry => geometry.dispose()); surfaces.dispose(); key.shadow.map?.dispose(); renderer.renderLists.dispose(); scene.clear();
  }
}

async function startPreviewJob(priority?: StyleId) {
  if (activeJob || unavailable || Object.keys(cache).length === interiorStyles.length) return;
  const job = { cancelled: false }; activeJob = job;
  let renderer: THREE.WebGLRenderer | undefined, pmrem: THREE.PMREMGenerator | undefined, environment: THREE.WebGLRenderTarget | undefined, room: RoomEnvironment | undefined;
  try {
    // Wait for the dialog to paint before compiling shaders and making local textures.
    await new Promise<void>(resolve => window.setTimeout(resolve, 100)); if (job.cancelled) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(480, 320); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    room = new RoomEnvironment(); pmrem = new THREE.PMREMGenerator(renderer); environment = pmrem.fromScene(room, .04, .1, 100, { size: 64 });
    const ordered = [...interiorStyles].sort((a, b) => Number(b.id === priority) - Number(a.id === priority));
    for (const style of ordered) {
      if (job.cancelled) break;
      if (cache[style.id]) continue;
      cache[style.id] = renderSampleRoom(renderer, environment.texture, style); publish(); await pause();
    }
  } catch (error) {
    console.warn('Style room preview could not be rendered.', error);
    unavailable = true; publish();
  } finally {
    environment?.dispose(); room?.dispose(); pmrem?.dispose(); renderer?.dispose(); renderer?.forceContextLoss();
    if (activeJob === job) activeJob = undefined;
    publish();
    if (listeners.size && !unavailable && Object.keys(cache).length < interiorStyles.length) void startPreviewJob(priority);
  }
}

export function useStyleRoomPreviews(priority?: StyleId) {
  const [, update] = useState(0);
  useEffect(() => {
    const listener = () => update(value => value + 1); listeners.add(listener); void startPreviewJob(priority);
    return () => { listeners.delete(listener); if (!listeners.size && activeJob) activeJob.cancelled = true; };
  }, [priority]);
  return { previews: cache, completed: Object.keys(cache).length, status: unavailable ? 'unavailable' as const : Object.keys(cache).length === interiorStyles.length ? 'ready' as const : 'loading' as const };
}

export function StyleRoomPreview({ style, src, unavailable: failed }: { style: InteriorStyle; src?: string; unavailable: boolean }) {
  return <div className="style-render-preview" data-testid="style-room-preview" data-style-id={style.id} data-preview-status={src ? 'ready' : failed ? 'unavailable' : 'loading'}>
    {src ? <img src={src} alt={`${style.name}實際 3D 樣板室預覽`} draggable={false}/> : <div className="style-preview-placeholder">{failed ? <Box size={24} strokeWidth={1.25}/> : <LoaderCircle size={22} className="style-preview-spinner"/>}<span>{failed ? '3D 預覽無法啟用' : '正在繪製實際模型…'}</span></div>}
    <span className="style-preview-caption">同一客廳 · 實際模型</span>
  </div>;
}
