const KEY = 'backrooms.save.v1';
const $ = (doc, id) => doc?.getElementById?.(id) || null;

function fallbackSave(win) {
  const settings = { sens: 1, sensV2: true, quality: 'medium', vibration: true, sound: true };
  try { Object.assign(settings, JSON.parse(win.localStorage.getItem(KEY) || '{}')); } catch {}
  return {
    settings: () => settings,
    setSettings(patch) { Object.assign(settings, patch); try { win.localStorage.setItem(KEY, JSON.stringify(settings)); } catch {} return settings; },
    progress() { return { unlocked: ['l0'], notes: {}, deaths: 0, wins: 0 }; }
  };
}

const plural = n => {
  const a = n % 100, b = n % 10;
  return a > 10 && a < 15 ? 'уровней' : b === 1 ? 'уровень' : b > 1 && b < 5 ? 'уровня' : 'уровней';
};
const count = value => Array.isArray(value) ? value.length : Number(value) || 0;
const countNotes = value => Array.isArray(value) ? value.length : value && typeof value === 'object'
  ? Object.values(value).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0)
  : count(value);

export function initTerminal(doc = document, win = globalThis, opts = {}) {
  const g = id => $(doc, id);
  const body = doc.body || { classList: { add() {}, remove() {} } };
  let levels = opts.levels ?? [];
  let save = opts.save ?? fallbackSave(win);
  let selectedId = null;
  let selectedCard = null;
  let toastTimer = 0;
  let toastMode = '';
  const toastEl = g('update-toast');
  const listen = (element, event, callback, options) => element?.addEventListener?.(event, callback, options);
  const setText = (id, value) => { const element = g(id); if (element) element.textContent = String(value); };
  const settings = () => {
    const value = typeof save.settings === 'function' ? save.settings() : save.settings;
    return value || {};
  };
  const setSettings = patch => { try { save.setSettings?.(patch); } catch {} };

  function toast(message, duration = 3200, mode = '') {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastMode = mode;
    win.clearTimeout?.(toastTimer);
    toastTimer = (win.setTimeout || setTimeout)(() => { toastEl.hidden = true; }, duration);
  }
  listen(toastEl, 'click', () => {
    if (toastMode === 'update') win.location.reload();
    else toastEl.hidden = true;
  });

  function isOpen(level, index) {
    if (typeof level.locked === 'boolean') return !level.locked;
    if (typeof save.isUnlocked === 'function') {
      try { return !!save.isUnlocked(level.id); } catch {}
    }
    const progress = save.progress?.() || {};
    const unlocked = progress.unlocked;
    if (Array.isArray(unlocked)) return unlocked.includes(level.id) || index === 0 && unlocked.length === 0;
    return index < Math.max(1, Number(unlocked) || 1);
  }

  function renderStats() {
    const progress = save.progress?.() || {};
    setText('stats-unlocked', count(progress.unlocked));
    setText('stats-notes', countNotes(progress.notes));
    setText('stats-deaths', count(progress.deaths));
    setText('level-count', levels.length ? levels.length + ' ' + plural(levels.length) : '0');
  }

  function renderLevels() {
    const grid = g('level-grid');
    const enter = g('enter-btn');
    if (!grid) return;
    grid.textContent = '';
    selectedId = null;
    selectedCard = null;
    if (!levels.length) {
      const empty = doc.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Новые секторы откроются после прохождения Лобби.';
      grid.appendChild(empty);
      if (enter) { enter.disabled = true; enter.textContent = 'НАЧАТЬ'; }
      return;
    }
    if (enter) { enter.disabled = true; enter.textContent = 'НАЧАТЬ'; }
    levels.forEach((level, index) => {
      const open = isOpen(level, index);
      const name = level.name ?? level.title ?? level.id;
      const card = doc.createElement('button');
      card.type = 'button';
      card.className = 'card' + (open ? '' : ' locked');
      if (card.dataset) card.dataset.id = level.id;
      const title = doc.createElement('b');
      title.textContent = name;
      const meta = doc.createElement('small');
      meta.textContent = open ? 'УРОВЕНЬ ' + index : 'ЗАБЛОКИРОВАН';
      card.appendChild(title);
      card.appendChild(meta);
      listen(card, 'click', () => {
        if (!open) { toast('Уровень заблокирован: пройди предыдущий'); return; }
        if (selectedCard) {
          selectedCard.classList.remove('selected');
          selectedCard.querySelector?.('.badge')?.remove?.();
        }
        card.classList.add('selected');
        selectedCard = card;
        selectedId = level.id;
        const badge = doc.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'ВЫБРАН';
        card.appendChild(badge);
        if (enter) { enter.disabled = false; enter.textContent = 'НАЧАТЬ: ' + name; }
      });
      grid.appendChild(card);
    });
  }

  const syncSettings = () => {
    const value = settings();
    const sensitivity = Math.max(1, Math.min(10, Number(value.sens ?? value.sensitivity ?? 1)));
    const sensInput = g('sens-range'), sensOutput = g('sens-val');
    const quality = g('quality-select'), vibration = g('vibration-check'), sound = g('sound-check');
    if (sensInput) sensInput.value = String(sensitivity);
    if (sensOutput) sensOutput.textContent = sensitivity.toFixed(1);
    if (quality) quality.value = value.quality ?? 'medium';
    if (vibration) vibration.checked = value.vibration !== false;
    if (sound) sound.checked = value.sound !== false;
    paintSound();
  };

  function openPanel(id) {
    ['level-panel', 'settings-panel'].forEach(panelId => {
      const panel = g(panelId);
      if (panel) panel.hidden = panelId !== id;
    });
    body.classList.add('in-panel');
  }
  function closePanels() {
    ['level-panel', 'settings-panel'].forEach(panelId => { const panel = g(panelId); if (panel) panel.hidden = true; });
    body.classList.remove('in-panel');
  }

  listen(g('play-btn'), 'click', () => { renderStats(); renderLevels(); openPanel('level-panel'); });
  listen(g('settings-btn'), 'click', () => { syncSettings(); openPanel('settings-panel'); });
  listen(g('level-back'), 'click', closePanels);
  listen(g('settings-back'), 'click', closePanels);
  listen(doc, 'keydown', event => { if (event.key === 'Escape') closePanels(); });
  listen(g('enter-btn'), 'click', () => {
    if (selectedId != null) win.location.href = './game.html?id=' + encodeURIComponent(selectedId);
  });
  listen(g('abyss-card'), 'click', () => { win.location.href = './game.html?id=abyss'; });
  listen(g('exit-btn'), 'click', () => { try { win.close?.(); } catch {} toast('Закрой вкладку браузера, чтобы выйти'); });

  let audioContext = null, terminalGain = null, terminalOscillators = [], firstGestureSeen = false;
  function humApply(enabled) {
    if (!firstGestureSeen) return;
    try {
      const AudioContextClass = win.AudioContext || win.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContext) {
        audioContext = new AudioContextClass();
        terminalGain = audioContext.createGain();
        terminalGain.gain.value = 0;
        const lowpass = audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 205;
        [
          [56, 'sawtooth', 0.18, -3.4],
          [59.3, 'sine', 0.13, 2.7],
          [83.7, 'triangle', 0.035, -5.2]
        ].forEach(([frequency, type, amplitude, detune]) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.type = type;
          oscillator.frequency.value = frequency;
          oscillator.detune.value = detune;
          gain.gain.value = amplitude;
          oscillator.connect(gain);
          gain.connect(lowpass);
          oscillator.start();
          terminalOscillators.push(oscillator);
        });
        lowpass.connect(terminalGain);
        terminalGain.connect(audioContext.destination);
      }
      if (audioContext.state === 'suspended') audioContext.resume();
      terminalGain.gain.setTargetAtTime(enabled ? 0.045 : 0, audioContext.currentTime, 0.24);
    } catch {}
  }
  function paintSound() {
    const button = g('sound-btn');
    const on = settings().sound !== false;
    button?.classList.toggle('muted', !on);
    button?.setAttribute('aria-pressed', String(on));
    humApply(on);
  }
  listen(g('sens-range'), 'input', event => {
    const value = Math.max(1, Math.min(10, Number(event.currentTarget?.value ?? g('sens-range')?.value) || 1));
    setText('sens-val', value.toFixed(1));
    setSettings({ sens: value, sensV2: true });
  });
  listen(g('quality-select'), 'change', event => setSettings({ quality: event.currentTarget.value }));
  listen(g('vibration-check'), 'change', event => setSettings({ vibration: !!event.currentTarget.checked }));
  listen(g('sound-check'), 'change', event => { setSettings({ sound: !!event.currentTarget.checked }); paintSound(); });
  listen(g('sound-btn'), 'click', () => {
    const next = settings().sound === false;
    setSettings({ sound: next });
    const checkbox = g('sound-check');
    if (checkbox) checkbox.checked = next;
    paintSound();
  });

  const firstGesture = () => {
    firstGestureSeen = true;
    humApply(settings().sound !== false);
  };
  listen(doc, 'pointerdown', firstGesture, { once: true });
  listen(doc, 'keydown', firstGesture, { once: true });

  const install = g('install-btn');
  let deferredInstall = null;
  listen(win, 'beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; });
  listen(win, 'appinstalled', () => { if (install) install.hidden = true; });
  listen(install, 'click', async () => {
    if (deferredInstall) {
      try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch {}
      deferredInstall = null;
    } else toast('Меню браузера: Добавить на главный экран', 4500);
  });
  try {
    if (win.matchMedia?.('(display-mode: standalone)').matches && install) install.hidden = true;
    win.navigator?.serviceWorker?.getRegistration?.().then(registration => {
      if (!registration) return;
      listen(registration, 'updatefound', () => {
        const worker = registration.installing;
        listen(worker, 'statechange', () => {
          if (worker.state === 'installed' && win.navigator.serviceWorker.controller) toast('Доступно обновление. Нажми, чтобы применить.', 12000, 'update');
        });
      });
    });
  } catch {}

  const rotateGate = g('rotate-gate');
  const isLandscape = () => win.innerWidth > win.innerHeight || /landscape/.test(win.screen?.orientation?.type || '') || !!win.matchMedia?.('(orientation: landscape)').matches;
  const hideRotateGate = () => { if (rotateGate) rotateGate.hidden = true; };
  if (rotateGate) {
    rotateGate.hidden = isLandscape();
    listen(rotateGate, 'click', hideRotateGate);
    listen(g('rotate-skip'), 'click', event => { event.stopPropagation(); hideRotateGate(); });
    const checkOrientation = () => { if (isLandscape()) hideRotateGate(); };
    listen(win, 'resize', checkOrientation);
    listen(win, 'orientationchange', checkOrientation);
    (win.setTimeout || setTimeout)(hideRotateGate, 4000);
  }

  const pointer = { x: 0, y: 0 };
  let pointerFrame = 0;
  listen(win, 'pointermove', event => {
    pointer.x = (event.clientX / Math.max(1, win.innerWidth) - 0.5) * 2;
    pointer.y = (event.clientY / Math.max(1, win.innerHeight) - 0.5) * 2;
    const raf = win.requestAnimationFrame || (callback => (win.setTimeout || setTimeout)(callback, 16));
    if (!pointerFrame) pointerFrame = raf(() => {
      pointerFrame = 0;
      doc.documentElement?.style?.setProperty('--px', pointer.x.toFixed(3));
      doc.documentElement?.style?.setProperty('--py', pointer.y.toFixed(3));
    });
  }, { passive: true });

  startBackground(doc, win, pointer);
  const refresh = () => { renderStats(); renderLevels(); syncSettings(); };
  refresh();
  const raf = win.requestAnimationFrame || (callback => (win.setTimeout || setTimeout)(callback, 16));
  raf(() => raf(() => body.classList.add('ready')));

  if (!opts.levels || !opts.save) {
    Promise.all([
      opts.levels ? null : import('../levels/all.js').catch(() => null),
      opts.save ? null : import('../engine/save.js').catch(() => null)
    ]).then(([registry, saveModule]) => {
      if (registry && Array.isArray(registry.levels)) levels = registry.levels;
      if (saveModule && typeof saveModule.createSave === 'function') { try { save = saveModule.createSave(); } catch {} }
      refresh();
    });
  }
  return { refresh, toast, openPanel, closePanels };
}

async function startBackground(doc, win, pointer) {
  const canvas = gCanvas(doc);
  if (!canvas || win.__bgLoop) return;
  let renderer = null, animationFrame = 0, world = null, scene = null, camera = null;
  let disposed = false;
  let visible = !doc.hidden;
  const onResize = () => {
    if (!renderer || !camera) return;
    const width = Math.max(1, win.innerWidth), height = Math.max(1, win.innerHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const stop = () => {
    if (animationFrame) win.cancelAnimationFrame?.(animationFrame);
    animationFrame = 0;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stop();
    win.removeEventListener?.('resize', onResize);
    doc.removeEventListener?.('visibilitychange', onVisibilityChange);
    win.removeEventListener?.('pagehide', dispose);
    try { world?.dispose?.(); } catch {}
    try { renderer?.dispose?.(); } catch {}
    win.__bgLoop = false;
    doc.body?.classList.remove('gl-ok');
  };
  const onVisibilityChange = () => {
    visible = !doc.hidden;
    if (!visible) stop();
    else if (!disposed && !animationFrame) animate();
  };

  try {
    const THREE = await import('../vendor/three.module.js');
    if (disposed) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#2f2812');
    scene.fog = new THREE.Fog('#2f2812', 10, 56);
    camera = new THREE.PerspectiveCamera(65, 1, 0.1, 80);
    camera.position.set(0, 1.62, 1.8);
    camera.rotation.order = 'YXZ';
    scene.add(new THREE.HemisphereLight('#f0d47a', '#392b13', 1.15));
    scene.add(new THREE.AmbientLight('#fff0c1', 0.34));
    const keyLight = new THREE.PointLight('#ffdf9a', 1.7, 22, 1.6);
    keyLight.position.set(0, 2.7, -9);
    scene.add(keyLight);

    const manual = await import('../world/manual.js');
    if (disposed) { renderer.dispose(); return; }
    world = manual.createManualWorld(THREE, scene, {
      bounds: { w: 24, d: 40 },
      height: 3,
      palette: { wall: '#e8d27a', floor: '#8a7a3a', ceiling: '#b7a98a' }
    });
    world.floor({ x: 0, z: -16, w: 16, d: 40, type: 'carpet' });
    world.ceiling({ x: 0, z: -16, w: 16, d: 40, type: 'ceiling' });
    world.box({ x: -8, z: -16, w: 0.32, h: 3, d: 40, palette: '#c7b65a' });
    world.box({ x: 8, z: -16, w: 0.32, h: 3, d: 40, palette: '#c7b65a' });
    world.box({ x: -5.25, z: -36, w: 5.5, h: 3, d: 0.32, palette: '#c7b65a' });
    world.box({ x: 5.25, z: -36, w: 5.5, h: 3, d: 0.32, palette: '#c7b65a' });
    world.box({ x: 0, z: 4, w: 16, h: 3, d: 0.32, palette: '#c7b65a' });
    [-6, -15, -24, -33].forEach(z => world.lightPanel({ x: 0, z, w: 1.5, d: 0.72 }));
    world.exit({ id: 'terminal-exit', x: 0, z: -35, color: '#7fff9f', data: { kind: 'frame' } });
    world.spawn({ x: 0, z: 1 });
    world.flush();

    onResize();
    win.addEventListener?.('resize', onResize);
    doc.addEventListener?.('visibilitychange', onVisibilityChange);
    win.addEventListener?.('pagehide', dispose, { once: true });
    win.__bgLoop = true;
    doc.body?.classList.add('gl-ok');
    const clock = new THREE.Clock();
    function animate() {
      if (disposed || !visible) return;
      animationFrame = win.requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      camera.position.x += (pointer.x * 0.22 - camera.position.x) * 0.045;
      camera.position.y = 1.62 + Math.sin(time * 0.42) * 0.012;
      camera.rotation.y += (-pointer.x * 0.07 - camera.rotation.y) * 0.045;
      camera.rotation.x += (-pointer.y * 0.035 - camera.rotation.x) * 0.045;
      world?.update?.(time);
      renderer.render(scene, camera);
    }
    animate();
  } catch {
    dispose();
    doc.body?.classList.remove('gl-ok');
  }
}

function gCanvas(doc) { return doc?.getElementById?.('bg3d') || null; }

if (typeof document !== 'undefined' && document.getElementById && document.getElementById('level-grid')) initTerminal();
