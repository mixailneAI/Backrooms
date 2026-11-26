export function createRender(THREE, canvas, opts = {}) {
  const maxPixelRatio = opts.maxPixelRatio ?? 2;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (THREE.ACESFilmicToneMapping != null) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 220);
  camera.rotation.order = 'YXZ';

  const hemi = new THREE.HemisphereLight('#d7c87d', '#6f6030', 0.95);
  const amb = new THREE.AmbientLight('#fff3c4', 0.38);
  const dir = new THREE.DirectionalLight('#fff0a8', 0.34);
  dir.position.set(0.2, 1, 0.1);
  scene.add(hemi, amb, dir);

  function applyFog(cfg) {
    const fog = cfg && cfg.fog;
    const pal = (cfg && cfg.palette) || {};
    if (fog) {
      const c = fog.color || '#2f2812';
      scene.fog = new THREE.Fog(c, fog.near ?? 13, fog.far ?? 78);
      renderer.setClearColor(c, 1);
    } else {
      scene.fog = null;
      renderer.setClearColor('#0d0b06', 1);
    }
    const wall = pal.wall && pal.wall.base ? pal.wall.base : '#c7b65a';
    const floor = pal.floor && pal.floor.base ? pal.floor.base : '#8a7a3a';
    const ceiling = pal.ceiling && pal.ceiling.base ? pal.ceiling.base : '#d6cdb4';
    hemi.color.set(ceiling);
    hemi.groundColor.set(floor);
    hemi.intensity = cfg && cfg.hemi != null ? cfg.hemi : 0.95;
    amb.intensity = cfg && cfg.ambientLight != null ? cfg.ambientLight : 0.38;
    dir.intensity = cfg && cfg.dirLight != null ? cfg.dirLight : 0.34;
    dir.color.set(wall);
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  return {
    renderer, scene, camera, hemi, amb, dir, applyFog,
    render() { renderer.render(scene, camera); },
    dispose() {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    }
  };
}
