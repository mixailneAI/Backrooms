// Рендер: пресеты качества, адаптивный FPS, лёгкий постпроцессинг (bloom/vignette/grade/grain).
// THREE передаётся аргументом — bare-import three запрещён (3.4).
const PRESETS = {
  low: { pr: 1.0, aa: false, exp: 1.04, post: false, bloom: 0.0 },
  medium: { pr: 1.5, aa: true, exp: 1.16, post: true, bloom: 0.35 },
  high: { pr: 2.0, aa: true, exp: 1.22, post: true, bloom: 0.55 }
};
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT = 'uniform sampler2D tDiffuse; uniform float uThreshold; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299, 0.587, 0.114)); float f = smoothstep(uThreshold, uThreshold + 0.25, l); gl_FragColor = vec4(c.rgb * f, 1.0); }';
const BLUR = 'uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv; void main(){ vec4 s = texture2D(tDiffuse, vUv) * 0.227027; s += (texture2D(tDiffuse, vUv + uDir * 1.3846154) + texture2D(tDiffuse, vUv - uDir * 1.3846154)) * 0.3162162; s += (texture2D(tDiffuse, vUv + uDir * 3.2307692) + texture2D(tDiffuse, vUv - uDir * 3.2307692)) * 0.0702703; gl_FragColor = s; }';
const COMP = 'uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform float uVignette; uniform float uTime; varying vec2 vUv; void main(){ vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom; c = c * vec3(1.03, 1.0, 0.94) + vec3(0.012, 0.010, 0.004); float d = distance(vUv, vec2(0.5)); c *= 1.0 - uVignette * smoothstep(0.45, 0.95, d); float g = fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453); c += (g - 0.5) * 0.02; c = clamp(c, 0.0, 1.0); gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0); }';
export function createRender(THREE, canvas, opts = {}) {
  let quality = PRESETS[opts.quality] ? opts.quality : 'medium';
  let adaptive = opts.adaptive !== false;
  let forcedPostOff = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: PRESETS[quality].aa, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PRESETS[quality].pr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (THREE.ACESFilmicToneMapping != null) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = PRESETS[quality].exp;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 220);
  camera.rotation.order = 'YXZ';
  const hemi = new THREE.HemisphereLight('#d7c87d', '#6f6030', 0.95);
  const amb = new THREE.AmbientLight('#fff3c4', 0.38);
  const dir = new THREE.DirectionalLight('#fff0a8', 0.34);
  dir.position.set(0.2, 1, 0.1);
  scene.add(hemi, amb, dir);
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quadScene.add(quad);
  let post = null;
  function disposePost() {
    if (!post) return;
    post.sceneRT.dispose(); post.brightRT.dispose(); post.blurRT.dispose();
    post.brightMat.dispose(); post.blurMat.dispose(); post.compMat.dispose();
    post = null;
  }
  function buildPost() {
    disposePost();
    if (!PRESETS[quality].post || forcedPostOff) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(2, size.x), h = Math.max(2, size.y);
    const bw = Math.max(2, Math.floor(w / 2)), bh = Math.max(2, Math.floor(h / 2));
    const rt = (ww, hh) => new THREE.WebGLRenderTarget(ww, hh, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    post = {
      sceneRT: rt(w, h), brightRT: rt(bw, bh), blurRT: rt(bw, bh),
      brightMat: new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BRIGHT, uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.62 } }, depthTest: false, depthWrite: false }),
      blurMat: new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BLUR, uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } }, depthTest: false, depthWrite: false }),
      compMat: new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: COMP, uniforms: { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: PRESETS[quality].bloom }, uVignette: { value: 0.42 }, uTime: { value: 0 } }, depthTest: false, depthWrite: false })
    };
  }
  buildPost();
  let fps = 60, acc = 0, frames = 0, lowSec = 0, lastT = 0;
  function notify(m) { if (api.onAdaptive) api.onAdaptive(m); }
  function sampleFps() {
    const t = performance.now();
    if (lastT) { acc += (t - lastT) / 1000; frames++; }
    lastT = t;
    if (acc >= 1) {
      fps = frames / acc; acc = 0; frames = 0;
      if (!adaptive) { lowSec = 0; return; }
      if (fps < 40) lowSec++; else lowSec = 0;
      if (lowSec >= 3) {
        lowSec = 0;
        const pr = renderer.getPixelRatio();
        if (fps < 25 && quality !== 'low') { quality = 'low'; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.0)); renderer.toneMappingExposure = PRESETS.low.exp; buildPost(); notify('Качество снижено до low (FPS)'); }
        else if (fps < 30 && post) { forcedPostOff = true; buildPost(); notify('Постпроцессинг выключен (FPS)'); }
        else if (pr > 0.75) { renderer.setPixelRatio(Math.max(0.75, pr - 0.25)); notify('Разрешение снижено (FPS)'); }
      }
    }
  }
  function render() {
    sampleFps();
    if (!post) { renderer.render(scene, camera); return; }
    renderer.setRenderTarget(post.sceneRT); renderer.render(scene, camera);
    quad.material = post.brightMat; post.brightMat.uniforms.tDiffuse.value = post.sceneRT.texture;
    renderer.setRenderTarget(post.brightRT); renderer.render(quadScene, quadCam);
    quad.material = post.blurMat; post.blurMat.uniforms.tDiffuse.value = post.brightRT.texture; post.blurMat.uniforms.uDir.value.set(1 / post.brightRT.width, 0);
    renderer.setRenderTarget(post.blurRT); renderer.render(quadScene, quadCam);
    post.blurMat.uniforms.tDiffuse.value = post.blurRT.texture; post.blurMat.uniforms.uDir.value.set(0, 1 / post.brightRT.height);
    renderer.setRenderTarget(post.brightRT); renderer.render(quadScene, quadCam);
    quad.material = post.compMat; post.compMat.uniforms.tScene.value = post.sceneRT.texture; post.compMat.uniforms.tBloom.value = post.brightRT.texture; post.compMat.uniforms.uTime.value = performance.now() / 1000;
    renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
  }
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
    buildPost();
  }
  window.addEventListener('resize', onResize);
  const api = {
    renderer, scene, camera, hemi, amb, dir, applyFog, render,
    onAdaptive: null,
    get quality() { return quality; },
    get fps() { return fps; },
    setQuality(q) {
      if (!PRESETS[q]) return;
      quality = q; forcedPostOff = false;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PRESETS[q].pr));
      renderer.toneMappingExposure = PRESETS[q].exp;
      renderer.shadowMap.enabled = q === 'high';
      buildPost();
    },
    setAdaptive(b) { adaptive = !!b; lowSec = 0; },
    dispose() {
      window.removeEventListener('resize', onResize);
      disposePost();
      quad.geometry.dispose();
      renderer.dispose();
    }
  };
  return api;
}
