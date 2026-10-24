import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { populateNordicScene } from './nordicScene';
import type { Plan } from './model';
import { getInteriorStyle } from './interiorStyles';
import { ArrowDownToLine, Focus, Palette } from 'lucide-react';
import './sceneControls.css';

type CameraMode = 'whole' | 'living' | 'master' | 'top';
export default function Scene3D({ plan, cutaway, furniture, labels, onChooseStyle, onExport, selected, onSelectFurniture }: { plan: Plan; cutaway: boolean; furniture: boolean; labels: boolean; onChooseStyle: () => void; onExport: () => void; selected?: string | null; onSelectFurniture?: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null), capture = useRef<(() => void) | null>(null), cameraMemory = useRef<{ width: number; depth: number; position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const focus = useRef<((mode: CameraMode) => void) | null>(null), highlight = useRef<((id?: string | null) => void) | null>(null), selection = useRef(selected), pick = useRef(onSelectFurniture);
  const style = getInteriorStyle(plan.style);
  const [error, setError] = useState(false), [cameraMode, setCameraMode] = useState<CameraMode>('whole');
  useEffect(() => { selection.current = selected; highlight.current?.(selected); }, [selected]);
  useEffect(() => { pick.current = onSelectFurniture; }, [onSelectFurniture]);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { setError(true); return; }
    setError(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.03; renderer.setClearColor(style.background, 1); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer), environment = new RoomEnvironment();
    const environmentMap = pmrem.fromScene(environment, .04); scene.environment = environmentMap.texture; scene.environmentIntensity = .42;
    environment.dispose(); pmrem.dispose();
    const camera = new THREE.PerspectiveCamera(38, 1, .08, Math.max(200, Math.max(plan.width, plan.depth) * 8));
    const size = Math.max(plan.width, plan.depth);
    camera.position.set(size * .94, size * 1.48, size * 1.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .4, 0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.03; controls.minDistance = .7; controls.maxDistance = size * 4;
    if (cameraMemory.current?.width === plan.width && cameraMemory.current.depth === plan.depth) { camera.position.copy(cameraMemory.current.position); controls.target.copy(cameraMemory.current.target); }
    scene.add(new THREE.HemisphereLight(style.light, style.floor, .9));
    const sun = new THREE.DirectionalLight(style.light, 2.7); sun.position.set(-size * .6, size * 1.6, size * .5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -size; sun.shadow.camera.right = size; sun.shadow.camera.top = size; sun.shadow.camera.bottom = -size; sun.shadow.normalBias = .018; sun.shadow.camera.far = size * 5; sun.shadow.bias = -.00015; sun.shadow.radius = 5; scene.add(sun);
    const fill = new THREE.DirectionalLight('#e7efff', .35); fill.position.set(size, size * .7, -size); scene.add(fill);
    const disposeScene = populateNordicScene(scene, plan, cutaway, furniture, labels);
    let dirty = true;
    const box = new THREE.Box3(), helper = new THREE.Box3Helper(box, 0x738d58); helper.visible = false; helper.renderOrder = 5; scene.add(helper);
    const showSelection = (id?: string | null) => { if (!id) { helper.visible = false; dirty = true; return; } const group = scene.children.find(o => o.userData.furnitureId === id); helper.visible = !!group; if (group) box.setFromObject(group); dirty = true; };
    highlight.current = showSelection; showSelection(selection.current);
    focus.current = mode => {
      if (mode === 'whole') { controls.target.set(0, .4, 0); camera.position.set(size * .94, size * 1.48, size * 1.2); }
      else if (mode === 'top') { controls.target.set(0, 0, 0); camera.position.set(.001, size * 1.85, .001); }
      else {
        const room = plan.rooms.find(r => mode === 'living' ? r.kind === 'living' || /客廳/.test(r.name) : r.kind === 'master' || /主臥/.test(r.name));
        if (!room) return;
        const span = room.bounds ? Math.max(room.bounds.w, room.bounds.d) : Math.max(3.2, Math.sqrt(Math.max(room.area, 8)));
        const x = room.x - plan.width / 2, z = room.y - plan.depth / 2;
        controls.target.set(x, .5, z); camera.position.set(x + span * .75, span * 1.35, z + span * .98);
      }
      controls.update(); dirty = true; setCameraMode(mode);
    };
    const resize = () => { const { width, height } = el.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); dirty = true; };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let start: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { if (e.button === 0) start = { x: e.clientX, y: e.clientY }; };
    const up = (e: PointerEvent) => {
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) { start = null; return; }
      start = null; const r = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children.filter(o => o.userData.furnitureId), true);
      if (hits.length) { let object: THREE.Object3D | null = hits[0].object; while (object && !object.userData.furnitureId) object = object.parent; if (object) pick.current?.(object.userData.furnitureId as string); }
    };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up);
    capture.current = () => { renderer.render(scene, camera); const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png'); a.download = `${plan.name}-${style.name}-3D.png`; a.click(); };
    let frame = 0;
    const draw = () => { frame = requestAnimationFrame(draw); if (controls.update() || dirty) { renderer.render(scene, camera); dirty = false; } }; draw();
    return () => { cameraMemory.current = { width: plan.width, depth: plan.depth, position: camera.position.clone(), target: controls.target.clone() }; capture.current = null; focus.current = null; highlight.current = null; cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); controls.dispose(); disposeScene(); helper.geometry.dispose(); if (Array.isArray(helper.material)) helper.material.forEach(m => m.dispose()); else helper.material.dispose(); sun.shadow.map?.dispose(); environmentMap.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [plan, cutaway, furniture, labels, style]);
  return <div className="scene-3d" ref={host} data-testid="scene-3d">
    {error && <div className="webgl-error">此瀏覽器無法啟用 WebGL。請啟用硬體加速，或切回 2D 繼續編輯。</div>}
    <div className="scene-top-actions"><button className="scene-style-label" onClick={onChooseStyle}><Palette size={13}/>{style.name} · 變更風格</button><button className="scene-export-button" onClick={() => { if (capture.current) { capture.current(); onExport(); } }}><ArrowDownToLine size={13}/>匯出 3D PNG</button></div>
    <div className="scene-camera-presets" aria-label="3D 鏡頭"><Focus size={14}/>{([['whole', '全屋全景'], ['living', '客廳細節'], ['master', '主臥細節'], ['top', '俯視格局']] as const).map(([id, name]) => <button key={id} className={cameraMode === id ? 'active' : ''} disabled={(id === 'living' || id === 'master') && !plan.rooms.some(r => id === 'living' ? r.kind === 'living' || /客廳/.test(r.name) : r.kind === 'master' || /主臥/.test(r.name))} onClick={() => focus.current?.(id)}>{name}</button>)}</div>
    <div className="scene-instructions">點家具調整外觀 <span>·</span> 拖曳旋轉 <span>·</span> 滾輪縮放 <span>·</span> 右鍵平移</div>
  </div>;
}
