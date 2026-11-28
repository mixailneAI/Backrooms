// THREE is injected by the caller so the application remains fully vendor-local.
const PRESETS = {
  low: { pr: 1, bloom: 0, vignette: 0, bloomScale: 0, exp: 1.04 },
  medium: { pr: 1.5, bloom: 0.38, vignette: 0.38, bloomScale: 0.5, exp: 1.12 },
  high: { pr: 2, bloom: 0.56, vignette: 0.46, bloomScale: 1, exp: 1.18 }
};

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT = `
uniform sampler2D tDiffuse;
uniform float uThreshold;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float contribution = smoothstep(uThreshold, uThreshold + 0.24, l);
  gl_FragColor = vec4(c.rgb * contribution, 1.0);
}`;
const BLUR = `
uniform sampler2D tDiffuse;
uniform vec2 uDir;
varying vec2 vUv;
void main(){
  vec4 s = texture2D(tDiffuse, vUv) * 0.227027;
  s += (texture2D(tDiffuse, vUv + uDir * 1.3846154) + texture2D(tDiffuse, vUv - uDir * 1.3846154)) * 0.3162162;
  s += (texture2D(tDiffuse, vUv + uDir * 3.2307692) + texture2D(tDiffuse, vUv - uDir * 3.2307692)) * 0.0702703;
  gl_FragColor = s;
}`;
const COMP = `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uResolution;
uniform float uBloom;
uniform float uVignette;
uniform float uTime;
varying vec2 vUv;
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 fxaa(){
  vec2 px = 1.0 / max(uResolution, vec2(1.0));
  vec3 nw = texture2D(tScene, vUv + vec2(-1.0,-1.0) * px).rgb;
  vec3 ne = texture2D(tScene, vUv + vec2( 1.0,-1.0) * px).rgb;
  vec3 sw = texture2D(tScene, vUv + vec2(-1.0, 1.0) * px).rgb;
  vec3 se = texture2D(tScene, vUv + vec2( 1.0, 1.0) * px).rgb;
  vec3 m  = texture2D(tScene, vUv).rgb;
  float lNw=luma(nw), lNe=luma(ne), lSw=luma(sw), lSe=luma(se), lM=luma(m);
  float minL=min(lM,min(min(lNw,lNe),min(lSw,lSe)));
  float maxL=max(lM,max(max(lNw,lNe),max(lSw,lSe)));
  vec2 dir=vec2(-((lNw+lNe)-(lSw+lSe)), ((lNw+lSw)-(lNe+lSe)));
  float reduce=max((lNw+lNe+lSw+lSe)*0.03125, 0.0078125);
  float rcp=1.0/(min(abs(dir.x),abs(dir.y))+reduce);
  dir=clamp(dir*rcp, vec2(-8.0), vec2(8.0))*px;
  vec3 a=0.5*(texture2D(tScene,vUv+dir*(-0.1666667)).rgb+texture2D(tScene,vUv+dir*0.1666667).rgb);
  vec3 b=a*0.5+0.25*(texture2D(tScene,vUv+dir*(-0.5)).rgb+texture2D(tScene,vUv+dir*0.5).rgb);
  float lb=luma(b);
  return (lb<minL || lb>maxL) ? a : b;
}
void main(){
  vec3 c = fxaa() + texture2D(tBloom, vUv).rgb * uBloom;
  float lum = luma(c);
  c = mix(vec3(lum), c, 0.85);
  float shadowMask = 1.0 - smoothstep(0.08, 0.52, lum);
  float highlightMask = smoothstep(0.42, 0.95, lum);
  c *= mix(vec3(0.96, 1.025, 0.93), vec3(1.055, 1.015, 0.91), highlightMask);
  c += vec3(0.006, 0.014, 0.004) * shadowMask;
  c *= 1.0 - uVignette * smoothstep(0.38, 0.96, distance(vUv, vec2(0.5)));
  float grain = fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453);
  c += (grain - 0.5) * 0.006;
  c = clamp(c, 0.0, 1.0);
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;

export function createRender(THREE, canvas, opts = {}) {
  let quality = PRESETS[opts.quality] ? opts.quality : 'medium';
  let adaptive = opts.adaptive !== false;
  let adaptiveBloomOff = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PRESETS[quality].pr));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = PRESETS[quality].exp;
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 220);
  camera.rotation.order = 'YXZ';

  const hemi = new THREE.HemisphereLight('#f1d77d', '#51421d', 1.05);
  const amb = new THREE.AmbientLight('#fff0c2', 0.31);
  const points = [
    new THREE.PointLight('#ffe3a0', 1.35, 18, 1.7),
    new THREE.PointLight('#ffd77c', 1.05, 16, 1.8),
    new THREE.PointLight('#ffe8b1', 1.15, 17, 1.8),
    new THREE.PointLight('#b8ffbd', 0.75, 12, 1.6)
  ];
  points[0].position.set(-6, 2.75, -8);
  points[1].position.set(6, 2.75, 0);
  points[2].position.set(-6, 2.75, 8);
  points[3].position.set(9, 1.6, 9);
  points.forEach((light, index) => {
    light.castShadow = quality === 'high' && index < 2;
    if (light.castShadow) {
      light.shadow.mapSize.set(512, 512);
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = 22;
    }
  });
  scene.add(hemi, amb, ...points);

  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quad.frustumCulled = false;
  quadScene.add(quad);
  let post = null;

  function disposePost() {
    if (!post) return;
    post.sceneRT.dispose();
    if (post.brightRT) post.brightRT.dispose();
    if (post.blurRT) post.blurRT.dispose();
    post.brightMat?.dispose();
    post.blurMat?.dispose();
    post.compMat.dispose();
    post = null;
  }

  function buildPost() {
    disposePost();
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(2, size.x), h = Math.max(2, size.y);
    const preset = PRESETS[quality];
    const withBloom = preset.bloom > 0 && !adaptiveBloomOff;
    const bw = Math.max(2, Math.floor(w * (preset.bloomScale || 0.5)));
    const bh = Math.max(2, Math.floor(h * (preset.bloomScale || 0.5)));
    const target = (tw, th) => new THREE.WebGLRenderTarget(tw, th, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false
    });
    post = {
      sceneRT: target(w, h),
      brightRT: withBloom ? target(bw, bh) : null,
      blurRT: withBloom ? target(bw, bh) : null,
      brightMat: withBloom ? new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: BRIGHT,
        uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.62 } },
        depthTest: false, depthWrite: false
      }) : null,
      blurMat: withBloom ? new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: BLUR,
        uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } },
        depthTest: false, depthWrite: false
      }) : null,
      compMat: new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: COMP,
        uniforms: {
          tScene: { value: null }, tBloom: { value: null },
          uResolution: { value: new THREE.Vector2(w, h) },
          uBloom: { value: withBloom ? preset.bloom : 0 },
          uVignette: { value: withBloom ? preset.vignette : 0 },
          uTime: { value: 0 }
        },
        depthTest: false, depthWrite: false
      })
    };
  }
  buildPost();

  let fps = 60, sampleSeconds = 0, frameCount = 0, lowSeconds = 0, lastSample = 0, adaptiveSteps = 0;
  function notify(message) { if (api.onAdaptive) api.onAdaptive(message); }
  function rebuildAtPixelRatio(ratio) {
    renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    buildPost();
  }
  function sampleFps() {
    const now = performance.now();
    if (lastSample) {
      sampleSeconds += (now - lastSample) / 1000;
      frameCount++;
    }
    lastSample = now;
    if (sampleSeconds < 4) return;
    fps = frameCount / sampleSeconds;
    const elapsed = sampleSeconds;
    sampleSeconds = 0;
    frameCount = 0;
    if (!adaptive) { lowSeconds = 0; return; }
    if (fps < 30) lowSeconds += elapsed;
    else lowSeconds = 0;
    if (lowSeconds < 8 || adaptiveSteps >= 2) return;
    lowSeconds = 0;
    adaptiveSteps++; const ratio = renderer.getPixelRatio();
    if (ratio > 0.75) {
      rebuildAtPixelRatio(Math.max(0.75, ratio - 0.2));
      notify('Разрешение адаптировано под FPS');
    } else if (PRESETS[quality].bloom > 0 && !adaptiveBloomOff) {
      adaptiveBloomOff = true;
      buildPost();
      notify('Bloom и виньетка отключены для стабильного FPS');
    } else if (ratio > 0.65) {
      rebuildAtPixelRatio(0.65);
      notify('Разрешение снижено до экономичного режима');
    }
  }

  function render() {
    sampleFps();
    if (!post) { renderer.render(scene, camera); return; }
    renderer.setRenderTarget(post.sceneRT);
    renderer.clear();
    renderer.render(scene, camera);

    let bloomTexture = post.sceneRT.texture;
    if (post.brightRT && post.blurRT) {
      post.brightMat.uniforms.tDiffuse.value = post.sceneRT.texture;
      renderer.setRenderTarget(post.brightRT);
      renderer.clear();
      quad.material = post.brightMat;
      renderer.render(quadScene, quadCamera);

      post.blurMat.uniforms.tDiffuse.value = post.brightRT.texture;
      post.blurMat.uniforms.uDir.value.set(1 / post.brightRT.width, 0);
      renderer.setRenderTarget(post.blurRT);
      renderer.clear();
      quad.material = post.blurMat;
      renderer.render(quadScene, quadCamera);

      post.blurMat.uniforms.tDiffuse.value = post.blurRT.texture;
      post.blurMat.uniforms.uDir.value.set(0, 1 / post.blurRT.height);
      renderer.setRenderTarget(post.brightRT);
      renderer.clear();
      renderer.render(quadScene, quadCamera);
      bloomTexture = post.brightRT.texture;
    }

    const comp = post.compMat;
    comp.uniforms.tScene.value = post.sceneRT.texture;
    comp.uniforms.tBloom.value = bloomTexture;
    comp.uniforms.uTime.value = performance.now() / 1000;
    renderer.setRenderTarget(null);
    quad.material = comp;
    renderer.render(quadScene, quadCamera);
  }

  function applyFog(config = {}) {
    const fog = config.fog;
    const palette = config.palette || {};
    if (fog) {
      const color = fog.color || '#332b14';
      scene.fog = new THREE.Fog(color, fog.near ?? 10, fog.far ?? 54);
      renderer.setClearColor(color, 1);
    } else {
      scene.fog = null;
      renderer.setClearColor('#0d0b06', 1);
    }
    const wall = typeof palette.wall === 'string' ? palette.wall : palette.wall?.base || '#c7b65a';
    const floor = typeof palette.floor === 'string' ? palette.floor : palette.floor?.base || '#8a7a3a';
    const ceiling = typeof palette.ceiling === 'string' ? palette.ceiling : palette.ceiling?.base || '#d6cdb4';
    hemi.color.set(ceiling);
    hemi.groundColor.set(floor);
    hemi.intensity = config.hemi ?? 1.05;
    amb.intensity = config.ambientLight ?? 0.31;
    points.forEach((light, index) => {
      if (index < 3) light.color.set(wall).lerp(new THREE.Color('#ffe7a4'), 0.58);
    });
  }

  function onResize() {
    const width = window.innerWidth, height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    buildPost();
  }
  window.addEventListener('resize', onResize);

  const api = {
    renderer, scene, camera, hemi, amb, points, applyFog, render,
    onAdaptive: null,
    get quality() { return quality; },
    get fps() { return fps; },
    setQuality(nextQuality) {
      if (!PRESETS[nextQuality]) return;
      quality = nextQuality;
      adaptiveBloomOff = false;
      renderer.shadowMap.enabled = quality === 'high';
      points.forEach((light, index) => { light.castShadow = quality === 'high' && index < 2; });
      renderer.toneMappingExposure = PRESETS[quality].exp;
      rebuildAtPixelRatio(Math.min(window.devicePixelRatio || 1, PRESETS[quality].pr));
    },
    setAdaptive(enabled) { adaptive = !!enabled; lowSeconds = 0; },
    dispose() {
      window.removeEventListener('resize', onResize);
      disposePost();
      quad.geometry.dispose();
      for (const child of scene.children) {
        if (child.isLight) scene.remove(child);
      }
      renderer.dispose();
    }
  };
  return api;
}
