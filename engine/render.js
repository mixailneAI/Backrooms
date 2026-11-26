// Рендер: WebGLRenderer, pixel-ratio, туман, свет, ACES tonemapping (4.4).
// THREE передаётся аргументом — bare-import three запрещён (3.4).
export function createRender(THREE, canvas, opts = {}) {
  const maxPixelRatio = opts.maxPixelRatio ?? 2;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (THREE.ACESFilmicToneMapping != null) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.rotation.order = 'YXZ';

  const hemi = new THREE.HemisphereLight('#c9bd7a', '#8a7a3a', 0.8);
  const amb = new THREE.AmbientLight('#ffffff', 0.30);
  const dir = new THREE.DirectionalLight('#fff2b0', 0.28);
  dir.position.set(0, 1, 0);
  scene.add(hemi, amb, dir);

  function applyFog(cfg) {
    const fog = cfg && cfg.fog;
    const pal = (cfg && cfg.palette) || {};
    if (fog) {
      const c = fog.color || '#2a2410';
      scene.fog = new THREE.Fog(c, fog.near ?? 12, fog.far ?? 70);
      renderer.setClearColor(c, 1);
    } else {
      scene.fog = null;
      renderer.setClearColor('#0d0b06', 1);
    }
    hemi.color.set(pal.ceiling || '#c9bd7a');
    hemi.groundColor.set(pal.floor || '#8a7a3a');
    hemi.intensity = cfg && cfg.hemi != null ? cfg.hemi : 0.8;
    amb.intensity = cfg && cfg.ambientLight != null ? cfg.ambientLight : 0.30;
    dir.intensity = cfg && cfg.dirLight != null ? cfg.dirLight : 0.28;
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
