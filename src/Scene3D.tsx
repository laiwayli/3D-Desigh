import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { exteriorSegments } from './model';
import type { Plan } from './model';

export default function Scene3D({ plan, cutaway, furniture }: { plan: Plan; cutaway: boolean; furniture: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setError(true); return; }
    setError(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor('#f1f3ed', 1); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 200);
    const size = Math.max(plan.width, plan.depth);
    camera.position.set(size * 1.15, size * 1.25, size * 1.4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .4, 0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.03; controls.minDistance = 4; controls.maxDistance = size * 4;
    scene.add(new THREE.HemisphereLight('#ffffff', '#c1c6b4', 2.5));
    const sun = new THREE.DirectionalLight('#fff4df', 3); sun.position.set(-8, 16, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -size; sun.shadow.camera.right = size; sun.shadow.camera.top = size; sun.shadow.camera.bottom = -size; sun.shadow.normalBias = .04; scene.add(sun);
    const materials: THREE.Material[] = [], geometries: THREE.BufferGeometry[] = [];
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, parent: THREE.Object3D = scene) => {
      const geo = new THREE.BoxGeometry(w, h, d), mat = new THREE.MeshStandardMaterial({ color, roughness: .82 });
      geometries.push(geo); materials.push(mat);
      const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    box(plan.width + .35, .16, plan.depth + .35, 0, -.12, 0, '#d5d6c8');
    box(plan.width, .04, plan.depth, 0, -.02, 0, '#eee8db');
    for (let i = .24; i < plan.width; i += .48) box(.009, .002, plan.depth, i - plan.width / 2, .004, 0, '#e0d8c8');
    [...exteriorSegments(plan), ...plan.walls].forEach(w => {
      const exterior = w.id.startsWith('ext-'), h = cutaway ? exterior ? .55 : 1.15 : plan.height;
      const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
      const mesh = box(len, h, w.thickness, (w.a.x + w.b.x) / 2 - plan.width / 2, h / 2, (w.a.y + w.b.y) / 2 - plan.depth / 2, exterior ? '#f5f2e8' : '#e6e8dc');
      mesh.rotation.y = -Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
    });
    if (furniture) plan.furniture.forEach(f => {
      const group = new THREE.Group(); group.position.set(f.x - plan.width / 2, 0, f.y - plan.depth / 2); group.rotation.y = -f.rotation * Math.PI / 180; scene.add(group);
      const { w, d } = f;
      if (f.kind === 'sofa' || f.kind === 'chair') {
        box(w, .35, d, 0, .28, 0, '#b8c1a9', group); box(w, .4, .15, 0, .62, -d / 2 + .075, '#a4b196', group);
        box(.12, .28, d, -w / 2 + .06, .55, 0, '#a9b59b', group); box(.12, .28, d, w / 2 - .06, .55, 0, '#a9b59b', group);
      } else if (f.kind === 'bed') {
        box(w, .25, d, 0, .2, 0, '#b0a08b', group); box(w - .06, .2, d - .06, 0, .42, 0, '#f5f2e7', group);
        box(w - .06, .06, d * .58, 0, .55, d * .17, '#d0c5b2', group);
        for (const sign of [-1, 1]) box(w * .38, .12, .4, sign * w * .23, .58, -d / 2 + .3, '#fffaf0', group);
        box(w + .06, .85, .1, 0, .43, -d / 2, '#c4b49b', group);
      } else if (f.kind === 'table' || f.kind === 'desk') {
        box(w, .08, d, 0, .72, 0, '#cfbb98', group);
        for (const x of [-1, 1]) for (const z of [-1, 1]) box(.055, .68, .055, x * (w / 2 - .12), .35, z * (d / 2 - .12), '#807e6c', group);
        if (f.kind === 'desk') { box(w * .4, .35, .045, 0, .98, -d * .2, '#505c53', group); box(.08, .1, .15, 0, .8, -d * .2, '#687263', group); }
      } else if (f.kind === 'plant') {
        const potGeo = new THREE.CylinderGeometry(w * .32, w * .23, .4, 20), leafGeo = new THREE.IcosahedronGeometry(w * .55, 1);
        geometries.push(potGeo, leafGeo); const potMat = new THREE.MeshStandardMaterial({ color: '#c5b39a' }), leafMat = new THREE.MeshStandardMaterial({ color: '#788e61' }); materials.push(potMat, leafMat);
        const pot = new THREE.Mesh(potGeo, potMat); pot.position.y = .2; pot.castShadow = true; group.add(pot);
        const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.y = .65; leaf.scale.y = 1.5; leaf.castShadow = true; group.add(leaf);
      } else if (f.kind === 'wardrobe') { box(w, 1.9, d, 0, .95, 0, '#d1c7b1', group); for (let i = 1; i < 4; i++) box(.012, 1.8, .015, -w / 2 + i * w / 4, .95, d / 2 + .005, '#b4aa95', group); }
      else if (f.kind === 'shower') { box(w, .06, d, 0, .03, 0, '#d8e5df', group); box(.04, .9, d, -w / 2, .45, 0, '#b2cdc5', group); }
      else if (f.kind === 'toilet') { box(w * .8, .4, d * .75, 0, .22, .05, '#fffdf4', group); box(w, .65, .2, 0, .33, -d / 2 + .1, '#f3f2e9', group); }
      else { box(w, .85, d, 0, .425, 0, '#c0c4ae', group); box(w + .03, .05, d + .03, 0, .875, 0, '#eeecdf', group); }
    });
    const resize = () => { const { width, height } = el.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    let frame = 0;
    const draw = () => { frame = requestAnimationFrame(draw); controls.update(); renderer.render(scene, camera); }; draw();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove(); };
  }, [plan, cutaway, furniture]);
  return <div className="scene-3d" ref={host} data-testid="scene-3d">{error && <div className="webgl-error">此瀏覽器無法啟用 WebGL。請啟用硬體加速，或切回 2D 繼續編輯。</div>}<div className="scene-instructions">拖曳旋轉視角 <span>·</span> 滾輪縮放 <span>·</span> 右鍵平移</div></div>;
}
