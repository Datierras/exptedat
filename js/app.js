// app.js — FINAL (con modales y envío grupal funcionando)
// ------------------------------------------------------

// ====== FIREBASE (v8 compat) ======
const firebaseConfig = {
  apiKey: "AIzaSyAHXCfXoJK1p_naZf5v0_cAa6cphX1e1E8",
  authDomain: "exptcoord.firebaseapp.com",
  projectId: "exptcoord",
  storageBucket: "exptcoord.firebasestorage.app",
  messagingSenderId: "416639039117",
  appId: "1:416639039117:web:d9422f6d853a760a3014c4",
  measurementId: "G-94PRRLFZV4"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
const Timestamp = firebase.firestore.Timestamp;

// ====== Estado global ======
const state = {
  currentUser: null,
  userProfile: { apodo: '' },
  scanner: null,
  scannerMode: null // 'carga' | 'busqueda'
};

// Utilidades
const $  = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => root.querySelectorAll(s);

// ====== REGEX de lectura por lector USB/HID ======
const EXP_SCAN_RE = /^(\d+)[-']?(\d+)[-']?([A-Za-z])[-/'"]?(\d{4})$/;

// ========== INICIALIZACIÓN *TRAS* CARGAR EL DOM ==========
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  // --- Selectores fijos (existen desde el inicio) ---
  const authContainer = $('#auth-container');
  const appContainer  = $('#app-container');
  const logoutBtn     = $('#logout-btn');
  const loginForm     = $('#login-form');
  const authError     = $('#auth-error');

  const tabCarga      = $('#tab-carga');
  const tabBusqueda   = $('#tab-busqueda');
  const cargaSection  = $('#carga-section');
  const busquedaSection = $('#busqueda-section');

  const expedienteForm    = $('#expediente-form');
  const saveExpedienteBtn = $('#save-expediente-btn');
  const settingsBtn       = $('#settings-btn');

  const modalOverlay      = $('#modal-overlay');
  const settingsModal     = $('#settings-modal');
  const advancedSearchModal = $('#advanced-search-modal');
  const labelModal        = $('#label-modal');
  const scannerModal      = $('#scanner-modal');

  const logoutSafe = () => auth.signOut();

  // ====== AUTH ======
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      state.currentUser = user;
      authContainer?.classList.add('hidden');
      appContainer?.classList.remove('hidden');
      logoutBtn?.classList.remove('hidden');

      await loadUserProfile();

      // Toggle tema
      const root = document.documentElement;
      const themeToggle = $('#theme-toggle');
      if (themeToggle) {
        const saved = localStorage.getItem('theme') || 'light';
        root.setAttribute('data-theme', saved);
        themeToggle.textContent = saved === 'dark' ? '☀️' : '🌙';
        themeToggle.onclick = null;
        themeToggle.addEventListener('click', () => {
          const cur = root.getAttribute('data-theme') || 'light';
          const next = cur === 'dark' ? 'light' : 'dark';
          root.setAttribute('data-theme', next);
          localStorage.setItem('theme', next);
          themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
        });
      }

      // Iniciar en pestaña CARGA
      switchTab('carga', { tabCarga, tabBusqueda, cargaSection, busquedaSection });

    } else {
      state.currentUser = null;
      authContainer?.classList.remove('hidden');
      appContainer?.classList.add('hidden');
      logoutBtn?.classList.add('hidden');
    }
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#login-email')?.value;
    const password = $('#login-password')?.value;
    try {
      await auth.signInWithEmailAndPassword(email, password);
      authError.textContent = '';
      loginForm.reset();
    } catch (error) {
      handleAuthError(error, authError);
    }
  });

  logoutBtn?.addEventListener('click', logoutSafe);

  // ====== PESTAÑAS ======
  tabCarga?.addEventListener('click', () =>
    switchTab('carga', { tabCarga, tabBusqueda, cargaSection, busquedaSection })
  );
  tabBusqueda?.addEventListener('click', () =>
    switchTab('busqueda', { tabCarga, tabBusqueda, cargaSection, busquedaSection })
  );

  // ====== NOMENCLATURA (acordeón) ======
  const dropdown = $('.custom-dropdown');
  const dropdownToggle = $('.dropdown-toggle');
  dropdownToggle?.addEventListener('click', () => dropdown?.classList.toggle('open'));

  // ====== PERFIL (Apodo) + “Bloquear extracto” ======
  const saveSettingsBtn = $('#save-settings-btn');
  const userApodoInput  = $('#user-apodo');
  saveSettingsBtn?.addEventListener('click', async () => {
    if (!state.currentUser) return;
    const apodo = (userApodoInput?.value || '').trim();
    try {
      await db.collection('usuarios').doc(state.currentUser.uid).set({ apodo }, { merge: true });
      state.userProfile.apodo = apodo;
      alert('Apodo guardado correctamente.');
      closeAllModals();
    } catch (e) {
      console.error(e); alert('No se pudo guardar el apodo.');
    }
  });
  setupExtractoAutofill(); // restaura botón “Editar/Bloquear extracto”

  // ====== MODALES (overlay + handlers comunes) ======
  const closeBtns = $$('.close-modal-btn');
  const advancedSearchBtn = $('#advanced-search-btn');
  const openEnvioModalBtn = $('#open-envio-modal-btn'); // botón “Envío grupal”
  const settingsBtnLocal = settingsBtn;

  function openModal(modalEl) {
    if (!modalEl) return;
    modalOverlay?.classList.remove('hidden');
    modalEl.classList.remove('hidden');
  }
  function closeAllModals() {
    modalOverlay?.classList.add('hidden');
    $$('.modal-content').forEach(m => m.classList.add('hidden'));
    try { state.scanner?.reset(); } catch(_) {}
    stopMediaTracks($('#scanner-video'));
  }
  window.openModal = openModal;   // por si otros scripts lo llaman
  window.closeAllModals = closeAllModals;

  advancedSearchBtn?.addEventListener('click', () => openModal(advancedSearchModal));
  openEnvioModalBtn?.addEventListener('click',  () => openModal($('#envio-modal')));
  settingsBtnLocal?.addEventListener('click',   () => openModal(settingsModal));
  modalOverlay?.addEventListener('click', (e) => { if (e.target === modalOverlay) closeAllModals(); });
  closeBtns.forEach(b => b.addEventListener('click', closeAllModals));

  // ====== FORM CARGA ======
  expedienteForm?.addEventListener('submit', (e) => onSaveExpediente(e, saveExpedienteBtn));

  // ====== LECTOR USB/HID → distribuir a CARGA / BÚSQUEDA / ENVÍO ======
  attachScanHandlersFor('carga');
  attachScanHandlersFor('search');
  attachScanHandlersFor('envio');

  // ====== BÚSQUEDA ======
  const searchForm = $('#search-form');
  const searchResultsContainer = $('#search-results');
  const clearSearchBtn = $('#clear-search-btn');
  const advancedSearchForm = $('#advanced-search-form');

  searchForm?.addEventListener('submit', (e) => { e.preventDefault(); performSearch(false, searchResultsContainer); });
  advancedSearchForm?.addEventListener('submit', (e) => { e.preventDefault(); performSearch(true, searchResultsContainer); closeAllModals(); });
  clearSearchBtn?.addEventListener('click', () => { searchForm?.reset(); if (searchResultsContainer) searchResultsContainer.innerHTML = ''; });

  // ====== SCANNER por cámara (ZXing) ======
  const scanCargaBtn    = $('#scan-carga-btn');
  const scanBusquedaBtn = $('#scan-busqueda-btn');
  const cameraSelect    = $('#camera-select');

  scanCargaBtn?.addEventListener('click', () => initScanner('carga'));
  scanBusquedaBtn?.addEventListener('click', () => initScanner('busqueda'));
  cameraSelect?.addEventListener('change', startScan);

  // ====== ETIQUETAS (50 mm) ======
  setupLabels();

  // ====== ENVÍO GRUPAL (modal) ======
  setupEnvioGrupal();

  // ====== Atajos ======
  document.addEventListener('keydown', (e) => {
    const inInput = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
    if (e.key === 'F2') { e.preventDefault(); switchTab('carga', { tabCarga, tabBusqueda, cargaSection, busquedaSection }); initScanner('carga'); }
    if (e.ctrlKey && e.key === 'Enter' && !inInput) { e.preventDefault(); $('#expediente-form')?.requestSubmit?.(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); switchTab('busqueda', { tabCarga, tabBusqueda, cargaSection, busquedaSection }); $('#search-numero')?.focus(); }
  });
}

// ====== Helpers de UI ======
function switchTab(activeTab, refs) {
  const { tabCarga, tabBusqueda, cargaSection, busquedaSection } = refs;
  [tabCarga, tabBusqueda].forEach(t => t?.classList.remove('active'));
  [cargaSection, busquedaSection].forEach(s => s?.classList.add('hidden'));

  if (activeTab === 'carga') {
    tabCarga?.classList.add('active'); cargaSection?.classList.remove('hidden');
  } else {
    tabBusqueda?.classList.add('active'); busquedaSection?.classList.remove('hidden');
  }
}

function handleAuthError(error, authErrorEl) {
  const msg = {
    'auth/invalid-email': 'El formato del correo es inválido.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/too-many-requests': 'Demasiados intentos. Inténtalo más tarde.'
  }[error?.code] || 'Ocurrió un error inesperado.';
  if (authErrorEl) authErrorEl.textContent = msg;
}

async function loadUserProfile() {
  if (!state.currentUser) return;
  const userDoc = await db.collection('usuarios').doc(state.currentUser.uid).get();
  if (userDoc.exists) {
    state.userProfile = userDoc.data() || {};
    const apodoInput = $('#user-apodo');
    if (apodoInput) apodoInput.value = state.userProfile.apodo || '';

    const sel = $('#carga-oficina');
    if (sel && state.userProfile.ultimaOficina) sel.value = state.userProfile.ultimaOficina;
  }
}

// ====== “Bloquear/Editar extracto” + autofill ======
function setupExtractoAutofill() {
  const numeroInp   = $('#carga-numero');
  const letraInp    = $('#carga-letra');
  const anioInp     = $('#carga-anio');
  const extractoInp = $('#carga-extracto');
  if (!numeroInp || !letraInp || !anioInp || !extractoInp) return;

  let toggleBtn = $('#toggle-extracto-edit');
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggle-extracto-edit';
    toggleBtn.type = 'button';
    toggleBtn.textContent = 'Editar extracto';
    toggleBtn.className = 'btn btn-secondary ml-2';
    extractoInp.insertAdjacentElement('afterend', toggleBtn);
  }
  function lockExtracto(lock=true){
    extractoInp.readOnly = lock;
    extractoInp.classList.toggle('readonly', lock);
    toggleBtn.textContent = lock ? 'Editar extracto' : 'Bloquear extracto';
  }
  async function fetchLastExtracto(){
    const numeroRaw = (numeroInp.value || '').trim();
    const letra  = (letraInp.value || '').trim().toUpperCase();
    const anio   = (anioInp.value  || '').trim();
    if (!numeroRaw || !letra || !anio) return;

    const numAsNumber = Number(numeroRaw);
    const candidates = isNaN(numAsNumber) ? [numeroRaw] : [numAsNumber, String(numeroRaw)];
    for (const numero of candidates){
      try {
        let q = db.collection('expedientes')
          .where('numero', '==', numero)
          .where('letra', '==', letra)
          .where('anio', '==', anio)
          .orderBy('createdAt', 'desc')
          .limit(1);
        const snap = await q.get();
        if (!snap.empty) {
          const doc = snap.docs[0].data();
          if (doc?.extracto && !extractoInp.dataset.userEdited) {
            extractoInp.value = doc.extracto; lockExtracto(true); extractoInp.dataset.autofilled='1';
            return;
          }
        }
      } catch(e){}
    }
    lockExtracto(false);
  }
  extractoInp.addEventListener('input', () => { extractoInp.dataset.userEdited = '1'; });
  toggleBtn.addEventListener('click', () => lockExtracto(!extractoInp.readOnly));
  ['change','blur'].forEach(evt=>{
    numeroInp.addEventListener(evt, fetchLastExtracto);
    letraInp.addEventListener(evt, fetchLastExtracto);
    anioInp.addEventListener(evt, fetchLastExtracto);
  });
  fetchLastExtracto();
}

// ====== Guardar expediente ======
async function onSaveExpediente(e, saveBtn) {
  e.preventDefault();
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }

  const autor = state.userProfile.apodo || state.currentUser?.email || 'sistema';
  const expedienteData = {
    codigo: $('#carga-codigo')?.value,
    numero: $('#carga-numero')?.value,
    letra:  ($('#carga-letra')?.value || '').toUpperCase(),
    anio:   $('#carga-anio')?.value,
    extracto: $('#carga-extracto')?.value,
    oficina: $('#carga-oficina')?.value,
    movimiento: $('input[name="movimiento"]:checked')?.value,
    autor,
    createdAt: Timestamp.now(),
    nomen: {
      circunscripcion: $('#nomen-circ')?.value,
      seccion: $('#nomen-secc')?.value,
      chacra: $('#nomen-chac')?.value,
      l_ch:   $('#nomen-lch')?.value,
      quinta: $('#nomen-quin')?.value,
      l_qt:   $('#nomen-lqt')?.value,
      fraccion: $('#nomen-frac')?.value,
      l_fr:     $('#nomen-lfr')?.value,
      manzana:  $('#nomen-manz')?.value,
      l_mz:     $('#nomen-lmz')?.value,
      parcela:  $('#nomen-parc')?.value,
      l_pc:     $('#nomen-lpc')?.value,
    },
    partidas: { prov: $('#part-prov')?.value, mun: $('#part-mun')?.value }
  };

  if (!expedienteData.oficina) {
    alert('Por favor, selecciona una oficina.');
    if (saveBtn) { saveBtn.disabled=false; saveBtn.textContent='Guardar expediente'; }
    return;
  }

  try {
    await db.collection('usuarios').doc(state.currentUser.uid)
      .set({ ultimaOficina: expedienteData.oficina }, { merge: true });

    await db.collection('expedientes').add(expedienteData);
    alert('Expediente guardado con éxito.');
    $('#expediente-form')?.reset();
    $('.custom-dropdown')?.classList.remove('open');
  } catch (err) {
    console.error(err); alert('Hubo un error al guardar.');
  } finally {
    if (saveBtn) { saveBtn.disabled=false; saveBtn.textContent='Guardar expediente'; }
  }
}

// ====== Lecturas USB/HID ======
function fillSection(prefix, c, n, l, a) {
  const fCod = $(`#${prefix}-codigo`);
  const fNum = $(`#${prefix}-numero`);
  const fLet = $(`#${prefix}-letra`);
  const fAn  = $(`#${prefix}-anio`);
  if (fCod) fCod.value = c;
  if (fNum) fNum.value = n;
  if (fLet) fLet.value = (l || '').toUpperCase();
  if (fAn)  fAn.value  = a;
}

function distributeTo(prefix, raw, srcEl) {
  const v = (raw || '').trim();
  const m = v.match(EXP_SCAN_RE);
  if (!m) return false;
  const [, c, n, l, a] = m;

  fillSection(prefix, c, n, l, a);

  if (prefix === 'envio') {
    addExpToEnvioLista({ codigo: c, numero: n, letra: l, anio: a });
    // limpiar campos para siguiente escaneo
    ['envio-codigo','envio-numero','envio-letra','envio-anio'].forEach(id => { const el = document.getElementById(id); if (el) el.value=''; });
    $('#envio-codigo')?.focus();
  }

  const codeId = `${prefix}-codigo`;
  if (srcEl && srcEl.id !== codeId) srcEl.value = '';
  else if (srcEl && srcEl.id === codeId) srcEl.value = c;

  const next = (prefix === 'carga') ? '#carga-extracto'
            : (prefix === 'search') ? '#search-extracto'
            : '#envio-codigo';
  $(next)?.focus();

  if (prefix === 'search') { try { $('#search-form')?.requestSubmit?.(); } catch(_) {} }
  return true;
}

function attachScanHandlersFor(prefix) {
  [`#${prefix}-codigo`, `#${prefix}-numero`, `#${prefix}-letra`, `#${prefix}-anio`].forEach(sel => {
    const el = $(sel);
    if (!el) return;

    el.addEventListener('input', () => { const v = el.value; if (v && v.length >= 8) distributeTo(prefix, v, el); });
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === 'Tab') { if (distributeTo(prefix, el.value, el)) ev.preventDefault(); }});
    el.addEventListener('paste', (ev) => { const t = (ev.clipboardData || window.clipboardData).getData('text'); if (distributeTo(prefix, t, el)) ev.preventDefault(); });
    el.addEventListener('change', () => distributeTo(prefix, el.value, el));
  });
}

// ====== Búsqueda ======
async function performSearch(isAdvanced=false, container) {
  if (container) container.innerHTML = '<p>Buscando...</p>';
  try {
    let base = db.collection('expedientes');

    if (isAdvanced) {
      const adv = {
        'nomen.circunscripcion': $('#adv-nomen-circ')?.value || '',
        'nomen.seccion':         $('#adv-nomen-secc')?.value || '',
        'nomen.chacra':          $('#adv-nomen-chac')?.value || '',
        'nomen.quinta':          $('#adv-nomen-quin')?.value || '',
        'nomen.manzana':         $('#adv-nomen-manz')?.value || '',
        'nomen.parcela':         $('#adv-nomen-parc')?.value || '',
        'partidas.prov':         $('#adv-part-prov')?.value || '',
        'partidas.mun':          $('#adv-part-mun')?.value || '',
      };
      for (const k in adv) { const v = adv[k].trim(); if (v) base = base.where(k, '==', v); }
      const ext = $('#search-extracto')?.value.trim();
      if (ext) { base = base.where('extracto','>=',ext).where('extracto','<=',ext+'\uf8ff'); }
      base = base.orderBy('createdAt','desc');
      const snap = await base.get();
      return renderSearchResults(snap, container);
    }

    const codigo = $('#search-codigo')?.value.trim();
    const numero = $('#search-numero')?.value.trim();
    const letra  = ($('#search-letra')?.value || '').trim().toUpperCase();
    const anio   = $('#search-anio')?.value.trim();
    const extracto = $('#search-extracto')?.value.trim();

    if (!numero) {
      if (container) container.innerHTML = '<p class="error-message">Para la búsqueda normal, el campo <strong>Número</strong> es obligatorio.</p>';
      return;
    }

    let q1 = base;
    if (codigo) q1 = q1.where('codigo','==',codigo);
    q1 = q1.where('numero','==',numero);
    if (letra) q1 = q1.where('letra','==',letra);
    if (anio)  q1 = q1.where('anio','==',anio);
    if (extracto) q1 = q1.where('extracto','>=',extracto).where('extracto','<=',extracto+'\uf8ff');
    q1 = q1.orderBy('createdAt','desc');

    let snap = await q1.get();
    if (snap.empty && !isNaN(Number(numero))) {
      let q2 = base;
      if (codigo) q2 = q2.where('codigo','==',codigo);
      q2 = q2.where('numero','==',Number(numero));
      if (letra) q2 = q2.where('letra','==',letra);
      if (anio)  q2 = q2.where('anio','==',anio);
      if (extracto) q2 = q2.where('extracto','>=',extracto).where('extracto','<=',extracto+'\uf8ff');
      q2 = q2.orderBy('createdAt','desc');
      try { const s2 = await q2.get(); snap = s2; } catch(e){ console.error(e); }
    }
    renderSearchResults(snap, container);
  } catch (e) {
    console.error(e);
    if (container) container.innerHTML = '<p class="error-message">Error al buscar. Puede requerir un índice compuesto.</p>';
  }
}

function formatDate(ts) {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2,'0'); const ap = h>=12?'pm':'am'; h = h%12 || 12;
  return `${dd}/${mm}/${yyyy} - ${h}:${m} ${ap}`;
}

function renderSearchResults(querySnapshot, container) {
  const c = container || $('#search-results');
  if (!c) return;
  if (querySnapshot.empty) { c.innerHTML = '<p>No se encontraron expedientes.</p>'; return; }
  c.innerHTML = '';
  let i=0;
  querySnapshot.forEach(doc=>{
    const d = doc.data();
    const id = `${d.codigo}-${d.numero}-${d.letra}-${d.anio}`;
    const fecha = d.createdAt ? formatDate(d.createdAt) : '—';
    const movRaw = (d.movimiento || d.ultimoMovimiento?.tipo || '').toString();
    const mov = movRaw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    let clase = mov==='recibimos'?'recibimos': mov==='enviamos'?'enviamos':'';
    const div = document.createElement('div');
    div.className = `result-item${i===0?' latest':''} ${clase}`;
    div.innerHTML = `
      ${i===0?'<span class="latest-badge">Último movimiento</span>':''}
      <strong>ID: ${id}</strong>
      <p class="meta"><strong>Fecha:</strong> ${fecha}</p>
      <p><strong>Extracto:</strong> ${d.extracto||''}</p>
      <p><strong>Oficina:</strong> ${d.oficina||''}</p>
      <p><strong>Movimiento:</strong> ${d.movimiento || d.ultimoMovimiento?.tipo || ''}</p>
      <p><strong>Autor:</strong> ${d.autor||''}</p>`;
    c.appendChild(div);
    i++;
  });
}

// ====== Scanner por cámara (ZXing) ======
function stopMediaTracks(videoEl) {
  if (!videoEl) return;
  const stream = videoEl.srcObject;
  if (stream?.getTracks) stream.getTracks().forEach(t=>t.stop());
  videoEl.srcObject = null;
}

let scanLock = false;

async function listVideoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d=>d.kind==='videoinput');
}

async function initScanner(mode) {
  state.scannerMode = mode;
  openModal($('#scanner-modal'));
  const scannerVideo = $('#scanner-video');
  const cameraSelect = $('#camera-select');
  const feedback = $('#scanner-feedback');

  if (scannerVideo) scannerVideo.setAttribute('playsinline','true');
  feedback && (feedback.textContent = 'Solicitando acceso a la cámara…');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:{ ideal:'environment' } } });
    if (scannerVideo) scannerVideo.srcObject = stream;
    try { await scannerVideo?.play(); } catch(_){}

    feedback && (feedback.textContent = 'Inicializando decodificador…');

    const ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
    state.scanner = new ZXing.BrowserMultiFormatReader();

    const inputs = await listVideoInputs();
    if (cameraSelect) {
      cameraSelect.innerHTML='';
      inputs.forEach((d,i)=> {
        const opt=document.createElement('option');
        opt.value=d.deviceId; opt.textContent=d.label || `Cámara ${i+1}`;
        cameraSelect.appendChild(opt);
      });
    }

    let preferred = inputs.find(d=>/back|rear|environment|trase/i.test(d.label));
    if (!preferred && inputs.length) preferred = inputs[inputs.length-1];

    stopMediaTracks(scannerVideo);
    scanLock=false;
    if (preferred) await startScanWithDevice(preferred.deviceId);
    else await startScanWithConstraints({ audio:false, video:{ facingMode:{ ideal:'environment' } } });

    feedback && (feedback.textContent='');
  } catch (err) {
    console.error(err);
    const feedback = $('#scanner-feedback');
    feedback && (feedback.textContent = 'Error al iniciar la cámara. Revisá permisos del navegador para esta página.');
  }
}

async function startScanWithDevice(deviceId) {
  const ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
  if (!state.scanner) state.scanner = new ZXing.BrowserMultiFormatReader();
  const scannerVideo = $('#scanner-video');
  stopMediaTracks(scannerVideo);

  await state.scanner.decodeFromVideoDevice(deviceId, scannerVideo, (result, err) => {
    if (result && !scanLock) { scanLock=true; handleScanResult(result.getText()); }
    if (err && err.constructor && err.constructor.name !== 'NotFoundException') console.warn('Decode error:', err);
  });
}

async function startScanWithConstraints(constraints) {
  const ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
  if (!state.scanner) state.scanner = new ZXing.BrowserMultiFormatReader();
  const scannerVideo = $('#scanner-video');
  stopMediaTracks(scannerVideo);

  await state.scanner.decodeFromConstraints(constraints, scannerVideo, (result, err) => {
    if (result && !scanLock) { scanLock=true; handleScanResult(result.getText()); }
    if (err && err.constructor && err.constructor.name !== 'NotFoundException') console.warn('Decode error:', err);
  });
}

async function startScan() {
  const id = $('#camera-select')?.value;
  if (!id) return;
  const fb = $('#scanner-feedback');
  try { fb && (fb.textContent='Cambiando de cámara…'); scanLock=false; await startScanWithDevice(id); fb && (fb.textContent=''); }
  catch { fb && (fb.textContent='No se pudo cambiar de cámara.'); }
}

function handleScanResult(text) {
  stopScanner();
  const parts = text.split('-');
  if (parts.length === 4) {
    if (state.scannerMode === 'carga') {
      $('#carga-codigo').value = parts[0];
      $('#carga-numero').value = parts[1];
      $('#carga-letra').value  = parts[2];
      $('#carga-anio').value   = parts[3];
    } else if (state.scannerMode === 'busqueda') {
      $('#search-codigo').value = parts[0];
      $('#search-numero').value = parts[1];
      $('#search-letra').value  = parts[2];
      $('#search-anio').value   = parts[3];
      $('#search-form')?.requestSubmit?.();
    }
  } else {
    alert('Código no reconocido. Formato esperado: CODIGO-NUMERO-LETRA-AÑO');
  }
}

function stopScanner() {
  try { state.scanner?.reset(); } catch(_){}
  stopMediaTracks($('#scanner-video'));
  closeAllModals();
}

// ====== Etiquetas (50 mm) ======
function setupLabels() {
  const generateLabelBtn = $('#generate-label-btn');
  const printLabelBtn    = $('#print-label-btn');
  const pdfLabelBtn      = $('#pdf-label-btn');
  const barcodeSvg       = $('#barcode');
  const labelIdText      = $('#label-id-text');

  generateLabelBtn?.addEventListener('click', () => {
    const codigo = $('#carga-codigo')?.value?.trim();
    const numero = $('#carga-numero')?.value?.trim();
    const letra  = ($('#carga-letra')?.value || '').trim().toUpperCase();
    const anio   = $('#carga-anio')?.value?.trim();
    if (!codigo || !numero || !letra || !anio) { alert('Completa Código, Número, Letra y Año.'); return; }

    const humanId   = `${codigo}-${numero}-${letra}/${anio}`;
    const barcodeId = `${codigo}-${numero}-${letra}-${anio}`;

    if (labelIdText) labelIdText.textContent = humanId;
    if (barcodeSvg) {
      barcodeSvg.style.width='50mm'; barcodeSvg.style.height='auto';
      barcodeSvg.setAttribute('preserveAspectRatio','xMidYMid meet');
      JsBarcode(barcodeSvg, barcodeId, { format:'CODE128', lineColor:'#000', width:1, height:28, displayValue:false, margin:4 });
    }
    openModal($('#label-modal'));
  });

  printLabelBtn?.addEventListener('click', () => {
    const html = $('#label-content')?.innerHTML || '';
    const w = window.open('', '', 'height=400,width=600');
    w.document.write('<html><head><title>Imprimir Etiqueta</title>');
    w.document.write('<style>body{text-align:center;font-family:sans-serif;} #barcode{width:50mm;height:auto;} svg{width:50mm !important;height:auto !important;}</style>');
    w.document.write('</head><body>');
    w.document.write(html);
    w.document.write('</body></html>');
    w.document.close(); w.focus(); w.print(); w.close();
  });

  pdfLabelBtn?.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const svgElement = $('#barcode');
    const labelIdText = $('#label-id-text');
    const humanId = labelIdText?.textContent || '';
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a6' });
    doc.setFontSize(14); doc.text('Etiqueta de Expediente', 74, 14, { align:'center' });
    doc.setFontSize(12); doc.text(humanId, 74, 22, { align:'center' });

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width=img.width; canvas.height=img.height; ctx.drawImage(img,0,0);
      const dataUrl=canvas.toDataURL('image/png');
      const width=50, height=(width*img.height)/img.width, x=(148-width)/2;
      doc.addImage(dataUrl,'PNG',x,36,width,height);
      doc.save('etiqueta-'+humanId.replace('/','-')+'.pdf');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  });
}

// ====== Envío grupal (modal) ======
function setupEnvioGrupal() {
  const envio = {
    lista: [],
    tablaBody: $('#tabla-envios tbody'),
    codigo:  $('#envio-codigo'),
    numero:  $('#envio-numero'),
    letra:   $('#envio-letra'),
    anio:    $('#envio-anio'),
    oficina: $('#envio-oficina-select'),
    btnAgregar:   $('#agregar-expediente'),
    btnConfirmar: $('#confirmar-envio-btn'),
  };

  function renderTabla() {
    if (!envio.tablaBody) return;
    envio.tablaBody.innerHTML = '';
    envio.lista.forEach((exp, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${exp.codigo}</td>
        <td>${exp.numero}</td>
        <td>${exp.letra}</td>
        <td>${exp.anio}</td>
        <td><button class="btn btn-sm btn-danger btn-eliminar" data-idx="${idx}" title="Quitar">❌</button></td>`;
      envio.tablaBody.appendChild(tr);
    });
    envio.tablaBody.querySelectorAll('.btn-eliminar').forEach(btn=>{
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx,10);
        if (!isNaN(i)) { envio.lista.splice(i,1); renderTabla(); }
      });
    });
  }

  window.addExpToEnvioLista = function({ codigo, numero, letra, anio }) {
    if (!codigo || !numero || !letra || !anio) return;
    const key = `${codigo}-${numero}-${(letra||'').toUpperCase()}-${anio}`.toUpperCase();
    const exists = envio.lista.some(x => `${x.codigo}-${x.numero}-${x.letra}-${x.anio}`.toUpperCase() === key);
    if (exists) return;
    envio.lista.push({ codigo, numero, letra:(letra||'').toUpperCase(), anio });
    renderTabla();
  };

  envio.btnAgregar?.addEventListener('click', () => {
    window.addExpToEnvioLista({
      codigo: envio.codigo?.value.trim(),
      numero: envio.numero?.value.trim(),
      letra:  envio.letra?.value.trim(),
      anio:   envio.anio?.value.trim(),
    });
    ['codigo','numero','letra','anio'].forEach(k => { const el = envio[k]; if (el) el.value=''; });
    envio.codigo?.focus();
  });

  envio.btnConfirmar?.addEventListener('click', async () => {
    const oficina = envio.oficina?.value || '';
    if (!oficina) return alert('Seleccioná una oficina de destino.');
    if (!envio.lista.length) return alert('No hay expedientes cargados.');
    if (!confirm(`¿Confirmar envío de ${envio.lista.length} expedientes a "${oficina}"?`)) return;

    try {
      const batch = db.batch();
      const autor = state.userProfile?.apodo || state.currentUser?.email || 'sistema';
      envio.lista.forEach(exp => {
        const ref = db.collection('expedientes').doc();
        batch.set(ref, {
          codigo: exp.codigo, numero: exp.numero, letra: exp.letra, anio: exp.anio,
          movimiento: 'Enviamos', oficina, autor, createdAt: Timestamp.now()
        });
      });
      await batch.commit();
      alert(`Se enviaron ${envio.lista.length} expedientes a ${oficina}.`);
      envio.lista = []; renderTabla(); envio.codigo?.focus();
    } catch (err) {
      console.error(err); alert('Error al registrar los envíos.');
    }
  });
}
