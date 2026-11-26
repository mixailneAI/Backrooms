import { clamp } from '../core/math.js';

// Рендер: инициализация WebGLRenderer, pixel-ratio с потолком 2, туман из конфига, resize (4.4).
// THREE передаётся аргументом — bare-import three запрещён (3.4).
export function createRender(THREE, canvas, opts = {}) {
  const maxPixelRatio = opts.maxPixelRatio ?? 2;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.rotation.order = 'YXZ';
  const applyFog = cfg => {
    if (cfg && cfg.fog) {
      const c = cfg.fog.color || '#2a2410';
      scene.fog = new THREE.Fog(c, cfg.fog.near ?? 6, cfg.fog.far ?? 34);
      renderer.setClearColor(c, 1);
    } else {
      scene.fog = null;
      renderer.setClearColor('#0d0b06', 1);
    }
  };
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  return {
    renderer, scene, camera, applyFog,
    render() { renderer.render(scene, camera); },
    dispose() {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    }
  };
}
