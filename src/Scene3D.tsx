import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { populateNordicScene } from './nordicScene';
import type { Plan } from './model';
import { getInteriorStyle } from './interiorStyles';
import { ArrowDownToLine, Palette } from 'lucide-react';

export default function Scene3D({ plan, cutaway, furniture, labels, onChooseStyle, onExport }: { plan: Plan; cutaway: boolean; furniture: boolean; labels: boolean; onChooseStyle: () => void; onExport: () => void }) {
  const host = useRef<HTMLDivElement>(null), capture = useRef<(() => void) | null>(null), cameraMemory = useRef<{ width: number; depth: number; position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const style = getInteriorStyle(plan.style);
  const [error, setError] = useState(false);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setError(true); return; }
    setError(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.setClearColor(style.background, 1); el.appendChild(renderer.domElement);
    capture.current = null;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, .1, Math.max(200, Math.max(plan.width, plan.depth) * 8));
    const size = Math.max(plan.width, plan.depth);
    camera.position.set(size * .94, size * 1.48, size * 1.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .4, 0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.03; controls.minDistance = 1; controls.maxDistance = size * 4;
    if (cameraMemory.current?.width === plan.width && cameraMemory.current.depth === plan.depth) { camera.position.copy(cameraMemory.current.position); controls.target.copy(cameraMemory.current.target); }
    scene.add(new THREE.HemisphereLight(style.light, style.floor, 1.8));
    const sun = new THREE.DirectionalLight(style.light, 3.2); sun.position.set(-size * .6, size * 1.6, size * .5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -size; sun.shadow.camera.right = size; sun.shadow.camera.top = size; sun.shadow.camera.bottom = -size; sun.shadow.normalBias = .025; sun.shadow.camera.far = size * 5; sun.shadow.bias = -.0002; sun.shadow.radius = 5; scene.add(sun);
    const disposeScene = populateNordicScene(scene, plan, cutaway, furniture, labels);
    const resize = () => { const { width, height } = el.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    capture.current = () => { renderer.render(scene, camera); const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png'); a.download = `${plan.name}-${style.name}-3D.png`; a.click(); };
    let frame = 0;
    const draw = () => { frame = requestAnimationFrame(draw); controls.update(); renderer.render(scene, camera); }; draw();
    return () => { cameraMemory.current = { width: plan.width, depth: plan.depth, position: camera.position.clone(), target: controls.target.clone() }; capture.current = null; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); disposeScene(); sun.shadow.map?.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [plan, cutaway, furniture, labels, style]);
  return <div className="scene-3d" ref={host} data-testid="scene-3d">{error && <div className="webgl-error">此瀏覽器無法啟用 WebGL。請啟用硬體加速，或切回 2D 繼續編輯。</div>}<div className="scene-top-actions"><button className="scene-style-label" onClick={onChooseStyle}><Palette size={13}/>{style.name} · 變更風格</button><button className="scene-export-button" onClick={() => { if (capture.current) { capture.current(); onExport(); } }}><ArrowDownToLine size={13}/>匯出 3D PNG</button></div><div className="scene-instructions">拖曳旋轉視角 <span>·</span> 滾輪縮放 <span>·</span> 右鍵平移</div></div>;
}
