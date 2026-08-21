import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { buildCameraFromUE, applyCoverFit } from './ueMath';
import { CAMERAS, MODEL_TRANSFORM, DEFAULT_CAMERA_KEY } from './config';
import floorGeometryData from './floorGeometry.json';
import './App.css';

function getCameraKeyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('cam');
  return key && CAMERAS[key] ? key : DEFAULT_CAMERA_KEY;
}

function buildFloorGeometry() {
  const { vertices, triangles } = floorGeometryData;
  const positions = new Float32Array(vertices.length * 3);
  for (let i = 0; i < vertices.length; i++) {
    positions[i * 3 + 0] = vertices[i][0];
    positions[i * 3 + 1] = vertices[i][1];
    positions[i * 3 + 2] = vertices[i][2];
  }
  const index = new Uint32Array(triangles.length * 3);
  for (let i = 0; i < triangles.length; i++) {
    index[i * 3 + 0] = triangles[i][0];
    index[i * 3 + 1] = triangles[i][1];
    index[i * 3 + 2] = triangles[i][2];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export default function App() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraKey, setCameraKey] = useState(getCameraKeyFromUrl);
  const [hovered, setHovered] = useState(false);

  const stateRef = useRef({});

  // Keep URL in sync (bonus: current state in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('cam', cameraKey);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [cameraKey]);

  const applyCamera = useCallback((key) => {
    const s = stateRef.current;
    if (!s.renderer) return;
    const camConfig = CAMERAS[key];

    const newCamera = buildCameraFromUE(camConfig);
    s.camera = newCamera;

    const rect = s.container.getBoundingClientRect();
    applyCoverFit(s.camera, rect.width, rect.height);

    s.imageEl.src = camConfig.image;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();

    const geometry = buildFloorGeometry();
    const material = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.0,
      depthWrite: true,
      side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...MODEL_TRANSFORM.position);
    mesh.rotation.y = THREE.MathUtils.degToRad(MODEL_TRANSFORM.rotationYDeg);
    scene.add(mesh);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const imageEl = document.getElementById('bg-photo');

    stateRef.current = { renderer, scene, mesh, raycaster, pointer, container, imageEl };

    applyCamera(cameraKey);

    function resize() {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      if (stateRef.current.camera) {
        applyCoverFit(stateRef.current.camera, rect.width, rect.height);
      }
    }
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      const s = stateRef.current;
      if (s.camera) renderer.render(scene, s.camera);
    }
    animate();

    function updatePointer(clientX, clientY) {
      const rect = container.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    function checkHover(clientX, clientY) {
      const s = stateRef.current;
      if (!s.camera) return;
      updatePointer(clientX, clientY);
      raycaster.setFromCamera(pointer, s.camera);
      const hits = raycaster.intersectObject(mesh, false);
      const isHit = hits.length > 0;
      material.opacity = isHit ? 0.45 : 0.0;
      setHovered(isHit);
    }

    function onPointerMove(e) {
      checkHover(e.clientX, e.clientY);
    }
    function onPointerDown(e) {
      checkHover(e.clientX, e.clientY);
    }
    function onPointerUp() {
      // Touch has no persistent "hover" state - treat release as leaving,
      // so a tap highlights only while the finger is actually down.
      material.opacity = 0.0;
      setHovered(false);
    }
    function onPointerLeave() {
      material.opacity = 0.0;
      setHovered(false);
    }

    // Pointer Events unify mouse + touch + pen, satisfying "mouse and touch
    // supported simultaneously" without separate code paths.
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointerleave', onPointerLeave);
    container.addEventListener('pointercancel', onPointerLeave);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('pointercancel', onPointerLeave);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyCamera(cameraKey);
  }, [cameraKey, applyCamera]);

  return (
    <div className="viewport" ref={containerRef}>
      <img id="bg-photo" className="bg-photo" src={CAMERAS[cameraKey].image} alt="" />
      <canvas ref={canvasRef} className="overlay-canvas" />

      <div className="ui-layer">
        <div className="camera-switch">
          {Object.entries(CAMERAS).map(([key, cfg]) => (
            <button
              key={key}
              className={key === cameraKey ? 'active' : ''}
              onClick={() => setCameraKey(key)}
            >
              {cfg.label}
            </button>
          ))}
        </div>
        {hovered && <div className="floor-badge">7th floor · Corpus A</div>}
      </div>
    </div>
  );
}
