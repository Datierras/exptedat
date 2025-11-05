// app.js — FINAL

// ====== FIREBASE (v8 compat) ======
const firebaseConfig = {
  apiKey: "AIzaSyC_0rQspoBE3c6bU_to7g4pFX2uhVHLtH4",
  authDomain: "exptcoord.firebaseapp.com",
  projectId: "exptcoord",
  storageBucket: "exptcoord.firebasestorage.app",
  messagingSenderId: "416639039117",
  appId: "1:416639039117:web:d9422f6d853a760a3014c4",
  measurementId: "G-94RPRLFZV4" // opcional
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
const Timestamp = firebase.firestore.Timestamp;

// ====== Estado ======
const state = {
  currentUser: null,
  userProfile: { apodo: '' },
  scanner: null,
  scannerMode: null // 'carga' | 'busqueda'
};

// Utils
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => r.querySelectorAll(s);

// Patrón para lector HID (4078-252307-I-2025 o con ' )
const EXP_SCAN_RE = /^(\d+)[-']?(\d+)[-']?([A-Za-z])[-/'"]?(\d{4})$/;

// ====== INIT ======
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  const authContainer = $('#auth-container');
  const appContainer  = $('#app-container');
  const logoutBtn     = $('#logout-btn');
  const loginForm     = $('#login-form');
  const authError     = $('#auth-error');

  const tabCarga      = $('#tab-carga');
  const tabEtiq       = $('#tab-etiquetas');
  const tabBusqueda   = $('#tab-busqueda');
  const cargaSection  = $('#carga-section');
  const etiqSection   = $('#etiquetas-section');
  const busquedaSection = $('#busqueda-section');

  const expedienteForm    = $('#expediente-form');
  const saveExpedienteBtn = $('#save-expediente-btn');
  const settingsBtn       = $('#settings-btn');

  // AUTH
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      state.currentUser = user;
      if (authContainer) authContainer.classList.add('hidden');
      if (appContainer)  appContainer.classList.remove('hidden');
      if (logoutBtn)     logoutBtn.classList.remove('hidden');
      await loadUserProfile();

      // Tema
      const root = document.documentElement;
      const themeToggle = $('#theme-toggle');
      if (themeToggle) {
        const saved = localStorage.getItem('theme') || 'light';
        root.setAttribute('data-theme', saved);
        themeToggle.textContent = saved === 'dark' ? '☀︎' : '☽';
        themeToggle.onclick = null;
        themeToggle.addEventListener('click', () => {
          const cur = root.getAttribute('data-theme') || 'light';
          const next = cur === 'dark' ? 'light' : 'dark';
          root.setAttribute('data-theme', next);
          localStorage.setItem('theme', next);
          themeToggle.textContent = next === 'dark' ? '☀︎' : '☽';
        });
      }

      switchTab('carga', {tabCarga,tabEtiq,tabBusqueda,cargaSection,etiqSection,busquedaSection});
    } else {
      state.currentUser = null;
      if (authContainer) authContainer.classList.remove('hidden');
      if (appContainer)  appContainer.classList.add('hidden');
      if (logoutBtn)     logoutBtn.classList.add('hidden');
    }
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#login-email')?.value;
      const password = $('#login-password')?.value;
      try {
        await auth.signInWithEmailAndPassword(email, password);
        if (authError) authError.textContent = '';
        loginForm.reset();
      } catch (error) {
        handleAuthError(error, authError);
      }
    });
  }

  if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

  // Tabs
  if (tabCarga)    tabCarga.addEventListener('click', () => switchTab('carga',    {tabCarga,tabEtiq,tabBusqueda,cargaSection,etiqSection,busquedaSection}));
  if (tabEtiq)     tabEtiq.addEventListener('click', () => switchTab('etiquetas',{tabCarga,tabEtiq,tabBusqueda,cargaSection,etiqSection,busquedaSection}));
  if (tabBusqueda) tabBusqueda.addEventListener('click', () => switchTab('busqueda',{tabCarga,tabEtiq,tabBusqueda,cargaSection,etiqSection,busquedaSection}));

  // Acordeón Nomenclatura
  const dropdown = $('.custom-dropdown');
  const dropdownToggle = $('.dropdown-toggle');
  if (dropdownToggle) dropdownToggle.addEventListener('click', () => { if (dropdown) dropdown.classList.toggle('open'); });

  // Perfil / Apodo + Lock Extracto
  const saveSettingsBtn = $('#save-settings-btn');
  const userApodoInput  = $('#user-apodo');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      if (!state.currentUser) return;
      const apodo = (userApodoInput?.value || '').trim();
      try {
        await db.collection('usuarios').doc(state.currentUser.uid).set({ apodo }, { merge: true });
        state.userProfile.apodo = apodo;
        alert('Apodo guardado correctamente.');
        closeAllModals();
      } catch (e) {
        console.error(e);
        alert('No se pudo guardar el apodo.');
      }
    });
  }
  setupExtractoAutofill();

  // Modales
  const advancedSearchBtn = $('#advanced-search-btn');
  const openEnvioModalBtn = $('#open-envio-modal-btn');
  if (advancedSearchBtn) advancedSearchBtn.addEventListener('click', () => openModal($('#advanced-search-modal')));
  if (openEnvioModalBtn) openEnvioModalBtn.addEventListener('click',  () => openModal($('#envio-modal')));
  if (settingsBtn) settingsBtn.addEventListener('click', () => openModal($('#settings-modal')));
  const modalOverlay = $('#modal-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeAllModals(); });
  }
  $$('.close-modal-btn').forEach(b => b.addEventListener('click', closeAllModals));

  // Carga
  if (expedienteForm) expedienteForm.addEventListener('submit', (e) => onSaveExpediente(e, saveExpedienteBtn));

  // HID → Carga / Búsqueda / Envío
  attachScanHandlersFor('carga');
  attachScanHandlersFor('search');
  attachScanHandlersFor('envio');

  // Búsqueda
  const searchForm = $('#search-form');
  const searchResultsContainer = $('#search-results');
  const clearSearchBtn = $('#clear-search-btn');
  const advancedSearchForm = $('#advanced-search-form');

  if (searchForm) searchForm.addEventListener('submit', (e) => { e.preventDefault(); performSearch(false, searchResultsContainer); });
  if (advancedSearchForm) advancedSearchForm.addEventListener('submit', (e) => { e.preventDefault(); performSearch(true, searchResultsContainer); closeAllModals(); });
  if (clearSearchBtn) clearSearchBtn.addEventListener('click', () => { if (searchForm) searchForm.reset(); if (searchResultsContainer) searchResultsContainer.innerHTML=''; });

  // ZXing (cámara)
  const scanCargaBtn = $('#scan-carga-btn');
  const scanBusquedaBtn = $('#scan-busqueda-btn');
  const cameraSelect = $('#camera-select');
  if (scanCargaBtn)    scanCargaBtn.addEventListener('click', () => initScanner('carga'));
  if (scanBusquedaBtn) scanBusquedaBtn.addEventListener('click', () => initScanner('busqueda'));
  if (cameraSelect)    cameraSelect.addEventListener('change', startScan);

  // Etiqueta individual
  setupLabels();

  // Etiquetas múltiples
  setupEtiquetasMultiples();

  // Envío grupal
  setupEnvioGrupal();

  // Atajos
  document.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    const inInput = ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName || '');
    if (e.key === 'F2') { e.preventDefault(); switchTab('carga', {tabCarga,tabEtiq,tabBusqueda,cargaSection,etiqSection,busquedaSection}); initScanner('carga'); }
    if (e.ctrlKey && e.key === 'Enter' && !inInput) { e.preventDefault(); const f=$('#expediente-form'); if (f && f.requestSubmit) f.requestSubmit(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); switchTab('busqueda', {tabCarga,tabEtiq,tabBusqueda,cargaSection,etiqSection,busquedaSection}); const n=$('#search-numero'); if (n) n.focus(); }
  });
}

// ===== UI helpers & Modals =====
function switchTab(active, refs) {
  const { tabCarga, tabEtiq, tabBusqueda, cargaSection, etiqSection, busquedaSection } = refs;
  [tabCarga,tabEtiq,tabBusqueda].forEach(t=>{ if (t) t.classList.remove('active'); });
  [cargaSection,etiqSection,busquedaSection].forEach(s=>{ if (s) s.classList.add('hidden'); });

  if (active==='carga')    { if (tabCarga) tabCarga.classList.add('active');        if (cargaSection)    cargaSection.classList.remove('hidden'); }
  if (active==='etiquetas'){ if (tabEtiq)  tabEtiq.classList.add('active');         if (etiqSection)     etiqSection.classList.remove('hidden'); }
  if (active==='busqueda') { if (tabBusqueda) tabBusqueda.classList.add('active');  if (busquedaSection) busquedaSection.classList.remove('hidden'); }
}

function openModal(modal) {
  const overlay = $('#modal-overlay');
  if (!modal || !overlay) return;
  overlay.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function closeAllModals() {
  const overlay = $('#modal-overlay');
  const all = $$('.modal-content');
  if (overlay) overlay.classList.add('hidden');
  all.forEach(m => m.classList.add('hidden'));
  try { if (state.scanner && state.scanner.reset) state.scanner.reset(); } catch (_) {}
  stopMediaTracks($('#scanner-video'));
}

function handleAuthError(error, outEl){
  const map = {
    'auth/invalid-email':'El formato del correo es inválido.',
    'auth/user-not-found':'Correo o contraseña incorrectos.',
    'auth/wrong-password':'Correo o contraseña incorrectos.',
    'auth/too-many-requests':'Demasiados intentos. Inténtalo más tarde.'
  };
  if (outEl) outEl.textContent = map[error && error.code] || 'Ocurrió un error inesperado.';
}

async function loadUserProfile() {
  if (!state.currentUser) return;
  const doc = await db.collection('usuarios').doc(state.currentUser.uid).get();
  if (doc.exists) {
    state.userProfile = doc.data() || {};
    const apodo = $('#user-apodo'); if (apodo) apodo.value = state.userProfile.apodo || '';
    const sel = $('#carga-oficina'); if (sel && state.userProfile.ultimaOficina) sel.value = state.userProfile.ultimaOficina;
  }
}

// ===== Extracto: autofill + lock =====
function setupExtractoAutofill() {
  const numeroInp   = $('#carga-numero');
  const letraInp    = $('#carga-letra');
  const anioInp     = $('#carga-anio');
  const extractoInp = $('#carga-extracto');
  if (!numeroInp || !letraInp || !anioInp || !extractoInp) return;

  let toggleBtn = $('#toggle-extracto-edit');
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.id='toggle-extracto-edit'; toggleBtn.type='button';
    toggleBtn.textContent='Editar extracto'; toggleBtn.className='btn btn-secondary ml-2';
    extractoInp.insertAdjacentElement('afterend', toggleBtn);
  }
  function lockExtracto(lock=true){
    extractoInp.readOnly = lock;
    extractoInp.classList.toggle('readonly', lock);
    toggleBtn.textContent = lock ? 'Editar extracto' : 'Bloquear extracto';
  }
  async function fetchLastExtracto(){
    const numeroRaw = (numeroInp.value || '').trim();
    const letra = (letraInp.value || '').trim().toUpperCase();
    const anio  = (anioInp.value || '').trim();
    if (!numeroRaw || !letra || !anio) return;

    const numAsNumber = Number(numeroRaw);
    const candidates = isNaN(numAsNumber) ? [numeroRaw] : [numAsNumber, String(numeroRaw)];
    for (const numero of candidates){
      try {
        let q = db.collection('expedientes')
          .where('numero','==',numero).where('letra','==',letra).where('anio','==',anio)
          .orderBy('createdAt','desc').limit(1);
        const snap = await q.get();
        if (!snap.empty) {
          const d = snap.docs[0].data();
          if (d && d.extracto && !extractoInp.dataset.userEdited) {
            extractoInp.value = d.extracto;
            lockExtracto(true);
            extractoInp.dataset.autofilled='1';
            return;
          }
        }
      } catch {}
    }
    lockExtracto(false);
  }
  extractoInp.addEventListener('input', () => { extractoInp.dataset.userEdited='1'; });
  toggleBtn.addEventListener('click', () => lockExtracto(!extractoInp.readOnly));
  ['change','blur'].forEach(evt => {
    numeroInp.addEventListener(evt, fetchLastExtracto);
    letraInp.addEventListener(evt, fetchLastExtracto);
    anioInp.addEventListener(evt, fetchLastExtracto);
  });
  fetchLastExtracto();
}

// ===== Guardar expediente =====
async function onSaveExpediente(e, btn){
  e.preventDefault();
  if (btn) { btn.disabled=true; btn.textContent='Guardando...'; }
  const autor = state.userProfile.apodo || (state.currentUser ? state.currentUser.email : '') || 'sistema';

  const expedienteData = {
    codigo: $('#carga-codigo')?.value,
    numero: $('#carga-numero')?.value,
    letra:  ($('#carga-letra')?.value || '').toUpperCase(),
    anio:   $('#carga-anio')?.value,
    extracto: $('#carga-extracto')?.value,
    oficina: $('#carga-oficina')?.value,
    movimiento: $('input[name="movimiento"]:checked')?.value,
    autor, createdAt: Timestamp.now(),
    nomen: {
      circunscripcion: $('#nomen-circ')?.value, seccion: $('#nomen-secc')?.value,
      chacra: $('#nomen-chac')?.value, l_ch: $('#nomen-lch')?.value,
      quinta: $('#nomen-quin')?.value, l_qt: $('#nomen-lqt')?.value,
      fraccion: $('#nomen-frac')?.value, l_fr: $('#nomen-lfr')?.value,
      manzana: $('#nomen-manz')?.value, l_mz: $('#nomen-lmz')?.value,
      parcela: $('#nomen-parc')?.value, l_pc: $('#nomen-lpc')?.value,
    },
    partidas: { prov: $('#part-prov')?.value, mun: $('#part-mun')?.value }
  };

  if (!expedienteData.oficina) {
    alert('Por favor, selecciona una oficina.');
    if (btn) { btn.disabled=false; btn.textContent='Guardar expediente'; }
    return;
  }

  try {
    if (state.currentUser) {
      await db.collection('usuarios').doc(state.currentUser.uid).set({ ultimaOficina: expedienteData.oficina }, { merge: true });
    }
    await db.collection('expedientes').add(expedienteData);
    alert('Expediente guardado con éxito.');
    const f = $('#expediente-form'); if (f) f.reset();
    const dd = $('.custom-dropdown'); if (dd) dd.classList.remove('open');
  } catch (err) {
    console.error(err);
    alert('Hubo un error al guardar.');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Guardar expediente'; }
  }
}

// ===== HID handlers (reparte a secciones) =====
function fillSection(prefix, c, n, l, a) {
  const ec = document.getElementById(`${prefix}-codigo`);
  const en = document.getElementById(`${prefix}-numero`);
  const el = document.getElementById(`${prefix}-letra`);
  const ea = document.getElementById(`${prefix}-anio`);
  if (ec) ec.value = c;
  if (en) en.value = n;
  if (el) el.value = (l||'').toUpperCase();
  if (ea) ea.value = a;
}

function distributeTo(prefix, raw, srcEl) {
  const m = (raw || '').trim().match(EXP_SCAN_RE);
  if (!m) return false;
  const [, c, n, l, a] = m;
  fillSection(prefix, c, n, l, a);

  if (prefix==='envio') {
    addExpToEnvioLista({ codigo:c, numero:n, letra:l, anio:a });
    ['envio-codigo','envio-numero','envio-letra','envio-anio'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value='';
    });
    const ec = document.getElementById('envio-codigo');
    if (ec) ec.focus();
  }

  if (srcEl && srcEl.id !== `${prefix}-codigo`) srcEl.value = '';
  let nextSel = '#carga-extracto';
  if (prefix==='search') nextSel = '#search-extracto';
  if (prefix==='envio')  nextSel = '#envio-codigo';
  const next = $(nextSel);
  if (next) next.focus();
  if (prefix==='search') {
    const sf = $('#search-form');
    if (sf && sf.requestSubmit) sf.requestSubmit();
  }
  return true;
}

function attachScanHandlersFor(prefix) {
  [`#${prefix}-codigo`, `#${prefix}-numero`, `#${prefix}-letra`, `#${prefix}-anio`].forEach(sel => {
    const el = $(sel); if (!el) return;
    el.addEventListener('input', () => {
      const v = el.value;
      if (v && v.length>=8) distributeTo(prefix, v, el);
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.key==='Enter'||ev.key==='Tab') {
        if (distributeTo(prefix, el.value, el)) ev.preventDefault();
      }
    });
    el.addEventListener('paste', (ev) => {
      const t = (ev.clipboardData||window.clipboardData).getData('text');
      if (distributeTo(prefix, t, el)) ev.preventDefault();
    });
    el.addEventListener('change', () => distributeTo(prefix, el.value, el));
  });
}

// ===== Búsqueda =====
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
      for (const k in adv) {
        const v = (adv[k] || '').trim();
        if (v) base = base.where(k,'==',v);
      }
      const ext = $('#search-extracto')?.value.trim();
      if (ext) base = base.where('extracto','>=',ext).where('extracto','<=',ext+'\uf8ff');
      base = base.orderBy('createdAt','desc');
      const snap = await base.get();
      return renderSearchResults(snap, container);
    }

    const codigo = $('#search-codigo')?.value.trim();
    const numero = $('#search-numero')?.value.trim();
    const letra  = ($('#search-letra')?.value || '').trim().toUpperCase();
    const anio   = $('#search-anio')?.value.trim();
    const extracto = $('#search-extracto')?.value.trim();
    if (!numero) { if (container) container.innerHTML='<p class="error-message">Para la búsqueda normal, el campo <strong>Número</strong> es obligatorio.</p>'; return; }

    let q1 = base; if (codigo) q1 = q1.where('codigo','==',codigo);
    q1 = q1.where('numero','==',numero);
    if (letra) q1 = q1.where('letra','==',letra);
    if (anio)  q1 = q1.where('anio','==',anio);
    if (extracto) q1 = q1.where('extracto','>=',extracto).where('extracto','<=',extracto+'\uf8ff');
    q1 = q1.orderBy('createdAt','desc');

    let snap = await q1.get();
    if (snap.empty && !isNaN(Number(numero))) {
      let q2 = base; if (codigo) q2 = q2.where('codigo','==',codigo);
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

function formatDate(ts){
  const d = ts && typeof ts.toDate==='function' ? ts.toDate() : new Date(ts);
  const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yyyy=d.getFullYear();
  let h=d.getHours(); const m=String(d.getMinutes()).padStart(2,'0'); const ap=h>=12?'pm':'am'; h=h%12||12;
  return `${dd}/${mm}/${yyyy} - ${h}:${m} ${ap}`;
}

function renderSearchResults(querySnapshot, container){
  const c = container || $('#search-results'); if (!c) return;
  if (querySnapshot.empty) { c.innerHTML='<p>No se encontraron expedientes.</p>'; return; }
  c.innerHTML=''; let i=0;
  querySnapshot.forEach(doc=>{
    const d=doc.data(); const id=`${d.codigo}-${d.numero}-${d.letra}-${d.anio}`; const fecha=d.createdAt?formatDate(d.createdAt):'—';
    const movRaw=(d.movimiento || (d.ultimoMovimiento && d.ultimoMovimiento.tipo) || '').toString();
    const mov=movRaw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    let clase = mov==='recibimos'?'recibimos': mov==='enviamos'?'enviamos':'';
    const div=document.createElement('div');
    div.className=`result-item${i===0?' latest':''} ${clase}`;
    div.innerHTML=
      `${i===0?'<span class="latest-badge">Último movimiento</span>':''}
      <strong>ID: ${id}</strong>
      <p class="meta"><strong>Fecha:</strong> ${fecha}</p>
      <p><strong>Extracto:</strong> ${d.extracto||''}</p>
      <p><strong>Oficina:</strong> ${d.oficina||''}</p>
      <p><strong>Movimiento:</strong> ${d.movimiento || (d.ultimoMovimiento && d.ultimoMovimiento.tipo) || ''}</p>
      <p><strong>Autor:</strong> ${d.autor||''}</p>`;
    c.appendChild(div); i++;
  });
}

// ===== ZXing (cámara) =====
function stopMediaTracks(videoEl){
  if(!videoEl) return;
  const s=videoEl.srcObject;
  if (s && s.getTracks) s.getTracks().forEach(t=>t.stop());
  videoEl.srcObject=null;
}
let scanLock=false;
async function listVideoInputs(){ const d=await navigator.mediaDevices.enumerateDevices(); return d.filter(x=>x.kind==='videoinput'); }

async function initScanner(mode){
  state.scannerMode=mode; openModal($('#scanner-modal'));
  const video=$('#scanner-video'); const fb=$('#scanner-feedback');
  if (video) video.setAttribute('playsinline','true');
  if (fb) fb.textContent='Solicitando acceso a la cámara…';
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
    if (video) video.srcObject=stream;
    try{ if (video && video.play) await video.play(); }catch{}
    if (fb) fb.textContent='Inicializando decodificador…';
    const ZXing=await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
    state.scanner=new ZXing.BrowserMultiFormatReader();
    const inputs=await listVideoInputs();
    stopMediaTracks(video);
    scanLock=false;
    if (inputs.length) await startScanWithDevice(inputs[inputs.length-1].deviceId);
    else await startScanWithConstraints({audio:false,video:{facingMode:{ideal:'environment'}}});
    if (fb) fb.textContent='';
  }catch(err){
    console.error(err);
    if (fb) fb.textContent='Error al iniciar la cámara. Revisá permisos.';
  }
}

async function startScanWithDevice(id){
  const ZXing=await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
  if(!state.scanner) state.scanner=new ZXing.BrowserMultiFormatReader();
  const video=$('#scanner-video'); stopMediaTracks(video);
  await state.scanner.decodeFromVideoDevice(id, video, (res, err) => {
    if(res && !scanLock){ scanLock=true; handleScanResult(res.getText()); }
    if(err && err.constructor && err.constructor.name!=='NotFoundException') console.warn('Decode error:', err);
  });
}
async function startScanWithConstraints(cons){
  const ZXing=await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
  if(!state.scanner) state.scanner=new ZXing.BrowserMultiFormatReader();
  const video=$('#scanner-video'); stopMediaTracks(video);
  await state.scanner.decodeFromConstraints(cons, video, (res, err)=>{
    if(res && !scanLock){ scanLock=true; handleScanResult(res.getText()); }
    if(err && err.constructor && err.constructor.name!=='NotFoundException') console.warn('Decode error:', err);
  });
}
async function startScan(){
  const id = $('#camera-select')?.value;
  if(!id) return;
  const fb=$('#scanner-feedback');
  try{
    if (fb) fb.textContent='Cambiando de cámara…';
    scanLock=false;
    await startScanWithDevice(id);
    if (fb) fb.textContent='';
  }catch{
    if (fb) fb.textContent='No se pudo cambiar de cámara.';
  }
}
function handleScanResult(text){
  stopScanner();
  const p=text.split('-');
  if(p.length===4){
    if(state.scannerMode==='carga'){
      $('#carga-codigo').value=p[0]; $('#carga-numero').value=p[1]; $('#carga-letra').value=p[2]; $('#carga-anio').value=p[3];
    } else if(state.scannerMode==='busqueda'){
      $('#search-codigo').value=p[0]; $('#search-numero').value=p[1]; $('#search-letra').value=p[2]; $('#search-anio').value=p[3];
      const sf=$('#search-form'); if (sf && sf.requestSubmit) sf.requestSubmit();
    }
  } else {
    alert('Código no reconocido. Formato: CODIGO-NUMERO-LETRA-AÑO');
  }
}
function stopScanner(){ try{ if (state.scanner && state.scanner.reset) state.scanner.reset(); }catch{} stopMediaTracks($('#scanner-video')); closeAllModals(); }

// ===== Etiqueta individual (50mm) =====
function setupLabels(){
  const generateLabelBtn=$('#generate-label-btn');
  const printLabelBtn=$('#print-label-btn');
  const pdfLabelBtn=$('#pdf-label-btn');
  const barcodeSvg=$('#barcode');
  const labelIdText=$('#label-id-text');

  if (generateLabelBtn) generateLabelBtn.addEventListener('click', () => {
    const codigo=$('#carga-codigo')?.value?.trim();
    const numero=$('#carga-numero')?.value?.trim();
    const letra=($('#carga-letra')?.value || '').trim().toUpperCase();
    const anio=$('#carga-anio')?.value?.trim();
    if(!codigo || !numero || !letra || !anio){ alert('Completa Código, Número, Letra y Año.'); return; }
    const humanId   = `${codigo}-${numero}-${letra}/${anio}`;
    const barcodeId = `${codigo}-${numero}-${letra}-${anio}`;
    if (labelIdText) labelIdText.textContent = humanId;
    if (barcodeSvg){
      barcodeSvg.style.width='50mm'; barcodeSvg.style.height='auto';
      barcodeSvg.setAttribute('preserveAspectRatio','xMidYMid meet');
      JsBarcode(barcodeSvg, barcodeId, { format:'CODE128', lineColor:'#000', width:1, height:28, displayValue:false, margin:4 });
    }
    openModal($('#label-modal'));
  });

  if (printLabelBtn) printLabelBtn.addEventListener('click', () => {
    const html=$('#label-content')?.innerHTML || '';
    const w=window.open('','','height=400,width=600');
    w.document.write('<html><head><title>Imprimir Etiqueta</title>');
    w.document.write('<style>body{text-align:center;font-family:sans-serif;} #barcode{width:50mm;height:auto;} svg{width:50mm !important;height:auto !important;}</style>');
    w.document.write('</head><body>'+html+'</body></html>');
    w.document.close(); w.focus(); w.print(); w.close();
  });

  if (pdfLabelBtn) pdfLabelBtn.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const svgElement = $('#barcode'); const humanId = $('#label-id-text')?.textContent || '';
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a6' });
    doc.setFontSize(14); doc.text('Etiqueta de Expediente', 74, 14, { align:'center' });
    doc.setFontSize(12); doc.text(humanId, 74, 22, { align:'center' });
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas=document.createElement('canvas'); const ctx=canvas.getContext('2d'); const img=new Image();
    img.onload = () => {
      canvas.width=img.width; canvas.height=img.height; ctx.drawImage(img,0,0);
      const dataUrl=canvas.toDataURL('image/png');
      const width=50; const height=(width*img.height)/img.width; const x=(148-width)/2;
      doc.addImage(dataUrl,'PNG',x,36,width,height);
      doc.save('etiqueta-'+humanId.replace('/','-')+'.pdf');
    };
    img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svgData)));
  });
}

// ===== Etiquetas múltiples (tab) =====
function setupEtiquetasMultiples(){
  const input = {
    codigo: $('#etq-codigo'), numero: $('#etq-numero'), letra: $('#etq-letra'), anio: $('#etq-anio'),
    addBtn: $('#etq-agregar-btn'), clearBtn: $('#etq-limpiar-btn'), genBtn: $('#etq-generar-btn'),
    tbody: $('#etq-tabla tbody')
  };
  const lista = [];
  function render(){
    if(!input.tbody) return;
    input.tbody.innerHTML='';
    lista.forEach((x,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${x.codigo}</td><td>${x.numero}</td><td>${x.letra}</td><td>${x.anio}</td>
        <td><button class="btn btn-sm btn-danger" data-i="${i}">❌</button></td>`;
      input.tbody.appendChild(tr);
    });
    input.tbody.querySelectorAll('button[data-i]').forEach(b=>{
      b.addEventListener('click', e=>{ const i=+e.currentTarget.dataset.i; lista.splice(i,1); render(); });
    });
  }

  if (input.addBtn) input.addBtn.addEventListener('click', ()=>{
    const obj = {
      codigo: input.codigo?.value.trim(),
      numero: input.numero?.value.trim(),
      letra:  (input.letra?.value || '').trim().toUpperCase(),
      anio:   input.anio?.value.trim()
    };
    if(!obj.codigo || !obj.numero || !obj.letra || !obj.anio) { alert('Completá todos los campos.'); return; }
    const key=`${obj.codigo}-${obj.numero}-${obj.letra}-${obj.anio}`.toUpperCase();
    if (lista.some(z => `${z.codigo}-${z.numero}-${z.letra}-${z.anio}`.toUpperCase()===key)) return;
    lista.push(obj);
    ['codigo','numero','letra','anio'].forEach(k=> { if (input[k]) input[k].value=''; });
    if (input.codigo) input.codigo.focus();
    render();
  });

  if (input.clearBtn) input.clearBtn.addEventListener('click', ()=>{ lista.length=0; render(); });

  if (input.genBtn) input.genBtn.addEventListener('click', async ()=>{
    if(!lista.length) { alert('No hay expedientes en la lista.'); return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit:'mm', format:'a4' });
    const colW = 60; const startX = 15; const startY = 20; const gapX = 10; const gapY = 18;
    let x = startX, y = startY, col = 0;
    for (let i=0;i<lista.length;i++){
      const e = lista[i]; const humanId = `${e.codigo}-${e.numero}-${e.letra}/${e.anio}`; const codeId  = `${e.codigo}-${e.numero}-${e.letra}-${e.anio}`;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      JsBarcode(svg, codeId, { format:'CODE128', width:1, height:18, displayValue:false, margin:0 });
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas=document.createElement('canvas'); const ctx=canvas.getContext('2d');
      const img = await new Promise(res => { const im=new Image(); im.onload=()=>res(im); im.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svgData))); });
      canvas.width=img.width; canvas.height=img.height; ctx.drawImage(img,0,0);
      const dataUrl = canvas.toDataURL('image/png');
      doc.setFontSize(10);
      doc.text(humanId, x + colW/2, y-4, { align:'center' });
      const bw=50; const bh=(bw*img.height)/img.width; const bx=x + (colW - bw)/2;
      doc.addImage(dataUrl, 'PNG', bx, y, bw, bh);
      col++; x += colW + gapX;
      if (col === 3) { col=0; x=startX; y += 25 + gapY; if (y > 280 && i < lista.length-1) { doc.addPage(); x=startX; y=startY; } }
    }
    doc.save('etiquetas.pdf');
  });
}

// ===== Envío grupal (modal) =====
function setupEnvioGrupal(){
  const envio = {
    lista: [],
    tablaBody: $('#tabla-envios tbody'),
    codigo: $('#envio-codigo'), numero: $('#envio-numero'), letra: $('#envio-letra'), anio: $('#envio-anio'),
    oficina: $('#envio-oficina-select'),
    btnAgregar: $('#agregar-expediente'),
    btnConfirmar: $('#confirmar-envio-btn'),
  };

  function renderTabla(){
    if(!envio.tablaBody) return;
    envio.tablaBody.innerHTML='';
    envio.lista.forEach((exp,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${exp.codigo}</td><td>${exp.numero}</td><td>${exp.letra}</td><td>${exp.anio}</td>
      <td><button class="btn btn-sm btn-danger btn-eliminar" data-idx="${idx}">❌</button></td>`;
      envio.tablaBody.appendChild(tr);
    });
    envio.tablaBody.querySelectorAll('.btn-eliminar').forEach(btn=>{
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx, 10);
        if (!isNaN(i)) { envio.lista.splice(i,1); renderTabla(); }
      });
    });
  }

  window.addExpToEnvioLista = function({codigo,numero,letra,anio}){
    if(!codigo||!numero||!letra||!anio) return;
    const key=`${codigo}-${numero}-${(letra||'').toUpperCase()}-${anio}`.toUpperCase();
    const exists = envio.lista.some(x => `${x.codigo}-${x.numero}-${x.letra}-${x.anio}`.toUpperCase() === key);
    if (exists) return;
    envio.lista.push({ codigo, numero, letra:(letra||'').toUpperCase(), anio });
    renderTabla();
  };

  if (envio.btnAgregar) envio.btnAgregar.addEventListener('click', ()=>{
    window.addExpToEnvioLista({
      codigo: envio.codigo?.value.trim(),
      numero: envio.numero?.value.trim(),
      letra:  envio.letra?.value.trim(),
      anio:   envio.anio?.value.trim()
    });
    ['codigo','numero','letra','anio'].forEach(k => { const el=envio[k]; if(el) el.value=''; });
    if (envio.codigo) envio.codigo.focus();
  });

  if (envio.btnConfirmar) envio.btnConfirmar.addEventListener('click', async ()=>{
    const oficina = envio.oficina?.value || '';
    if (!oficina) { alert('Seleccioná una oficina de destino.'); return; }
    if (!envio.lista.length) { alert('No hay expedientes cargados.'); return; }
    if (!confirm(`¿Confirmar envío de ${envio.lista.length} expedientes a "${oficina}"?`)) return;
    try {
      const batch = db.batch();
      const autor = (state.userProfile && state.userProfile.apodo) || (state.currentUser && state.currentUser.email) || 'sistema';
      envio.lista.forEach(exp => {
        const ref = db.collection('expedientes').doc();
        batch.set(ref, {
          codigo: exp.codigo, numero: exp.numero, letra: exp.letra, anio: exp.anio,
          movimiento: 'Enviamos', oficina, autor, createdAt: Timestamp.now()
        });
      });
      await batch.commit();
      alert(`Se enviaron ${envio.lista.length} expedientes a ${oficina}.`);
      envio.lista = []; renderTabla();
      if (envio.codigo) envio.codigo.focus();
    } catch (err) {
      console.error(err);
      alert('Error al registrar los envíos.');
    }
  });
}
