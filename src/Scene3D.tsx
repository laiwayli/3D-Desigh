import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { populateNordicScene } from './nordicScene';
import type { Plan } from './model';

export default function Scene3D({ plan, cutaway, furniture, labels }: { plan: Plan; cutaway: boolean; furniture: boolean; labels: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setError(true); return; }
    setError(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.setClearColor('#f0ece4', 1); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 200);
    const size = Math.max(plan.width, plan.depth);
    camera.position.set(size * .94, size * 1.48, size * 1.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .4, 0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.03; controls.minDistance = 4; controls.maxDistance = size * 4;
    scene.add(new THREE.HemisphereLight('#fff5e5', '#c4b499', 2));
    const sun = new THREE.DirectionalLight('#fff0d6', 3.2); sun.position.set(-size * .6, size * 1.6, size * .5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -size; sun.shadow.camera.right = size; sun.shadow.camera.top = size; sun.shadow.camera.bottom = -size; sun.shadow.normalBias = .025; sun.shadow.camera.far = size * 5; sun.shadow.bias = -.0002; sun.shadow.radius = 5; scene.add(sun);
    const disposeScene = populateNordicScene(scene, plan, cutaway, furniture, labels);
    const resize = () => { const { width, height } = el.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    let frame = 0;
    const draw = () => { frame = requestAnimationFrame(draw); controls.update(); renderer.render(scene, camera); }; draw();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); disposeScene(); sun.shadow.map?.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [plan, cutaway, furniture, labels]);
  return <div className="scene-3d" ref={host} data-testid="scene-3d">{error && <div className="webgl-error">此瀏覽器無法啟用 WebGL。請啟用硬體加速，或切回 2D 繼續編輯。</div>}<div className="scene-style-label">北歐簡約白系 · 淺木紋 · 暖光</div><div className="scene-instructions">拖曳旋轉視角 <span>·</span> 滾輪縮放 <span>·</span> 右鍵平移</div></div>;
}
