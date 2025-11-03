// app.js — CARGA + BÚSQUEDA + ETIQUETAS (lote 3x8) + PDF minimalista

// --- Firebase config (tu proyecto) ---
const firebaseConfig = {
  apiKey: "AIzaSyAHXCfXoJK1p_naZf5v0_cAa6cphX1e1E8",
  authDomain: "exptcoord.firebaseapp.com",
  projectId: "exptcoord",
  storageBucket: "exptcoord.firebasestorage.app",
  messagingSenderId: "416639039117",
  appId: "1:416639039117:web:d9422f6d853a760a3014c4",
  measurementId: "G-94PRRLFZV4"
};

// --- Firebase v8 compat ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const Timestamp = firebase.firestore.Timestamp;

// Estado
const state = {
  currentUser: null,
  userProfile: { apodo: '' },
  scanner: null,
  scannerMode: null, // 'carga'|'busqueda'
};

// Helpers DOM
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Auth
const authContainer = $('#auth-container');
const appContainer  = $('#app-container');
const logoutBtn     = $('#logout-btn');
const loginForm     = $('#login-form');
const authError     = $('#auth-error');

// Tabs y secciones
const tabCarga     = $('#tab-carga');
const tabEtiquetas = $('#tab-etiquetas');
const tabBusqueda  = $('#tab-busqueda');

const cargaSection     = $('#carga-section');
const etiquetasSection = $('#etiquetas-section');
const busquedaSection  = $('#busqueda-section');

// CARGA
const expedienteForm    = $('#expediente-form');
const saveExpedienteBtn = $('#save-expediente-btn');
const settingsBtn       = $('#settings-btn');

// Modales
const modalOverlay     = $('#modal-overlay');
const allModals        = $$('.modal-content');
const settingsModal    = $('#settings-modal');
const advancedSearchModal = $('#advanced-search-modal');
const labelModal       = $('#label-modal');
const closeModalBtn    = $('#close-modal-btn');

// Perfil
const saveSettingsBtn = $('#save-settings-btn');
const userApodoInput  = $('#user-apodo');

// Nomenclatura desplegable
const dropdown       = $('.custom-dropdown');
const dropdownToggle = $('.dropdown-toggle');

// Etiquetas (single)
const generateLabelBtn = $('#generate-label-btn');
const labelIdText      = $('#label-id-text');
const barcodeSvg       = $('#barcode');
const printLabelBtn    = $('#print-label-btn');
const pdfLabelBtn      = $('#pdf-label-btn');

// Escáner cámara
const scanCargaBtn   = $('#scan-carga-btn');
const scanBusquedaBtn= $('#scan-busqueda-btn');
const scannerModal   = $('#scanner-modal');
const scannerVideo   = $('#scanner-video');
const cameraSelect   = $('#camera-select');

// Búsqueda
const searchForm             = $('#search-form');
const searchResultsContainer = $('#search-results');
const clearSearchBtn         = $('#clear-search-btn');
const advancedSearchBtn      = $('#advanced-search-btn');
const advancedSearchForm     = $('#advanced-search-form');

// ETIQUETAS (lote)
const lblCodigo  = $('#lbl-codigo');
const lblNumero  = $('#lbl-numero');
const lblLetra   = $('#lbl-letra');
const lblAnio    = $('#lbl-anio');
const lblAddBtn  = $('#lbl-add-btn');
const lblClearBtn= $('#lbl-clear-btn');
const lblTableTB = $('#lbl-table tbody');
const lblGenBtn  = $('#lbl-generate-pdf-btn');
const labelsState = { list: [] };

// ========== Auto-completar extracto ==========
(function setupExtractoAutofill(){
  const numeroInp   = document.getElementById('carga-numero');
  const letraInp    = document.getElementById('carga-letra');
  const anioInp     = document.getElementById('carga-anio');
  const extractoInp = document.getElementById('carga-extracto');
  if (!numeroInp || !letraInp || !anioInp || !extractoInp) return;

  let toggleBtn = document.getElementById('toggle-extracto-edit');
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

    const numeroAsNumber = Number(numeroRaw);
    const numeroCandidates = isNaN(numeroAsNumber) ? [numeroRaw] : [numeroAsNumber, String(numeroRaw)];

    for (const numero of numeroCandidates){
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
          if (doc && doc.extracto) {
            if (!extractoInp.dataset.userEdited) {
              extractoInp.value = doc.extracto;
              lockExtracto(true);
            }
            extractoInp.dataset.autofilled = '1';
            return;
          }
        }
      } catch(err){ console.warn('[extracto-autofill]', err); }
    }
    lockExtracto(false);
  }

  extractoInp.addEventListener('input', () => {
    extractoInp.dataset.userEdited = '1';
  });
  toggleBtn.addEventListener('click', () => lockExtracto(!extractoInp.readOnly));
  ['change','blur'].forEach(evt=>{
    numeroInp.addEventListener(evt, fetchLastExtracto);
    letraInp.addEventListener(evt, fetchLastExtracto);
    anioInp.addEventListener(evt, fetchLastExtracto);
  });
  document.addEventListener('DOMContentLoaded', fetchLastExtracto);
})();

// ========== Auth ==========
auth.onAuthStateChanged(user => {
  if (user) {
    state.currentUser = user;
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loadUserProfile();

    // tema
    const root = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      const saved = localStorage.getItem('theme') || 'light';
      root.setAttribute('data-theme', saved);
      themeToggle.textContent = saved === 'dark' ? '☀️' : '🌙';
      themeToggle.onclick = null;
      themeToggle.addEventListener('click', () => {
        const current = root.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
      });
    }
  } else {
    state.currentUser = null;
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value;
  const password = $('#login-password').value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    authError.textContent = '';
    loginForm.reset();
  } catch (error) { handleAuthError(error); }
});
logoutBtn?.addEventListener('click', () => auth.signOut());

function handleAuthError(error) {
  switch (error.code) {
    case 'auth/invalid-email':    authError.textContent = 'El formato del correo es inválido.'; break;
    case 'auth/user-not-found':
    case 'auth/wrong-password':   authError.textContent = 'Correo o contraseña incorrectos.';   break;
    case 'auth/too-many-requests':authError.textContent = 'Demasiados intentos. Inténtalo más tarde.'; break;
    default:                      authError.textContent = 'Ocurrió un error inesperado.';
  }
}

async function loadUserProfile() {
  if (!state.currentUser) return;
  const ref = db.collection('usuarios').doc(state.currentUser.uid);
  const snap = await ref.get();
  if (snap.exists) {
    state.userProfile = snap.data();
    userApodoInput.value = state.userProfile.apodo || '';
    const sel = document.querySelector('#carga-oficina');
    if (sel && state.userProfile.ultimaOficina) sel.value = state.userProfile.ultimaOficina;
  }
}

saveSettingsBtn?.addEventListener('click', async () => {
  if (!state.currentUser) return;
  const apodo = userApodoInput.value.trim();
  try {
    await db.collection('usuarios').doc(state.currentUser.uid).set({ apodo }, { merge: true });
    state.userProfile.apodo = apodo;
    alert('Apodo guardado.');
    closeAllModals();
  } catch(e){ alert('No se pudo guardar.'); }
});

// ========== Navegación por pestañas ==========
function switchTab(active) {
  const tabs = [tabCarga, tabEtiquetas, tabBusqueda];
  const secs = [cargaSection, etiquetasSection, busquedaSection];

  tabs.forEach(t => t?.classList.remove('active'));
  secs.forEach(s => s?.classList.add('hidden'));

  if (active === 'carga') {
    tabCarga?.classList.add('active');     cargaSection?.classList.remove('hidden');
  } else if (active === 'etiquetas') {
    tabEtiquetas?.classList.add('active'); etiquetasSection?.classList.remove('hidden');
  } else {
    tabBusqueda?.classList.add('active');  busquedaSection?.classList.remove('hidden');
  }
}
tabCarga?.addEventListener('click',     () => switchTab('carga'));
tabEtiquetas?.addEventListener('click', () => switchTab('etiquetas'));
tabBusqueda?.addEventListener('click',  () => switchTab('busqueda'));

// ========== CARGA ==========
dropdownToggle?.addEventListener('click', () => dropdown?.classList.toggle('open'));

expedienteForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveExpedienteBtn.disabled = true;
  saveExpedienteBtn.textContent = 'Guardando...';

  const autor = state.userProfile.apodo || state.currentUser.email;

  const expedienteData = {
    codigo: $('#carga-codigo').value,
    numero: $('#carga-numero').value,
    letra:  $('#carga-letra').value.toUpperCase(),
    anio:   $('#carga-anio').value,
    extracto: $('#carga-extracto').value,
    oficina:  $('#carga-oficina').value,
    movimiento: $('input[name="movimiento"]:checked').value,
    autor,
    createdAt: Timestamp.now(),
    nomen: {
      circunscripcion: $('#nomen-circ').value, seccion: $('#nomen-secc').value,
      chacra: $('#nomen-chac').value, l_ch: $('#nomen-lch').value,
      quinta: $('#nomen-quin').value, l_qt: $('#nomen-lqt').value,
      fraccion: $('#nomen-frac').value, l_fr: $('#nomen-lfr').value,
      manzana: $('#nomen-manz').value, l_mz: $('#nomen-lmz').value,
      parcela: $('#nomen-parc').value, l_pc: $('#nomen-lpc').value,
    },
    partidas: { prov: $('#part-prov').value, mun: $('#part-mun').value }
  };

  if (!expedienteData.oficina) {
    alert("Selecciona una oficina."); saveExpedienteBtn.disabled=false; saveExpedienteBtn.textContent='Guardar expediente'; return;
  }

  try {
    await db.collection('usuarios').doc(state.currentUser.uid)
      .set({ ultimaOficina: expedienteData.oficina }, { merge: true });
  } catch(_) {}

  try {
    await db.collection('expedientes').add(expedienteData);
    alert('Expediente guardado.');
    expedienteForm.reset();
    dropdown?.classList.remove('open');
  } catch (err) {
    console.error(err); alert('Error al guardar.');
  } finally {
    saveExpedienteBtn.disabled=false; saveExpedienteBtn.textContent='Guardar expediente';
  }
});

// ========== Distribución de lecturas HID ==========
const EXP_SCAN_RE = /^(\d+)[-']?(\d+)[-']?([A-Za-z])[-/'"]?(\d{4})$/;

function fillSection(prefix, c, n, l, a) {
  const fCod = document.querySelector(`#${prefix}-codigo`);
  const fNum = document.querySelector(`#${prefix}-numero`);
  const fLet = document.querySelector(`#${prefix}-letra`);
  const fAn  = document.querySelector(`#${prefix}-anio`);
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

  const codeId = `${prefix}-codigo`;
  if (srcEl && srcEl.id !== codeId) srcEl.value = '';
  else if (srcEl && srcEl.id === codeId) srcEl.value = c;

  const next = (prefix === 'carga') ? '#carga-extracto'
            : (prefix === 'search') ? '#search-extracto'
            : '#lbl-codigo';
  document.querySelector(next)?.focus();

  if (prefix === 'etiquetas') {
    addLabelRow({ codigo: c, numero: n, letra: (l||'').toUpperCase(), anio: a });
    lblCodigo.value = lblNumero.value = lblLetra.value = lblAnio.value = '';
  }

  if (prefix === 'search') {
    try { searchForm?.requestSubmit?.(); } catch(_) {}
  }
  return true;
}

function attachScanHandlersFor(prefix) {
  ['codigo','numero','letra','anio'].forEach(name => {
    const el = document.querySelector(`#${prefix}-${name}`);
    if (!el) return;

    el.addEventListener('input', () => {
      const val = el.value;
      if (val && val.length >= 8) distributeTo(prefix, val, el);
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === 'Tab') {
        if (distributeTo(prefix, el.value, el)) ev.preventDefault();
      }
    });
    el.addEventListener('paste', (ev) => {
      const text = (ev.clipboardData || window.clipboardData).getData('text');
      if (distributeTo(prefix, text, el)) ev.preventDefault();
    });
    el.addEventListener('change', () => distributeTo(prefix, el.value, el));
  });
}
attachScanHandlersFor('carga');
attachScanHandlersFor('search');
// Para el tab “ETIQUETAS” usamos los ids lbl-* solo manual; si querés escanear, renombrar inputs a etiquetas-codigo etc.

// ========== Etiqueta individual (Code128, 50mm) ==========
generateLabelBtn?.addEventListener('click', () => {
  const codigo = $('#carga-codigo').value.trim();
  const numero = $('#carga-numero').value.trim();
  const letra  = ($('#carga-letra').value || '').trim().toUpperCase();
  const anio   = $('#carga-anio').value.trim();
  if (!codigo || !numero || !letra || !anio) {
    alert('Completa Código, Número, Letra y Año.'); return;
  }

  const humanId   = `${codigo}-${numero}-${letra}/${anio}`;
  const barcodeId = `${codigo}-${numero}-${letra}-${anio}`;
  labelIdText.textContent = humanId;

  barcodeSvg.style.width  = '50mm';
  barcodeSvg.style.height = 'auto';
  barcodeSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  JsBarcode(barcodeSvg, barcodeId, {
    format: "CODE128", lineColor: "#000",
    width: 1, height: 28, displayValue: false, margin: 4
  });
  openModal(labelModal);
});

printLabelBtn?.addEventListener('click', () => {
  const html = $('#label-content').innerHTML;
  const w = window.open('', '', 'height=400,width=600');
  w.document.write('<html><head><title>Imprimir</title><style>body{text-align:center;font-family:sans-serif;} #barcode{width:50mm;height:auto;} svg{width:50mm !important;height:auto !important;}</style></head><body>');
  w.document.write(html);
  w.document.write('</body></html>');
  w.document.close(); w.focus(); w.print(); w.close();
});

// PDF A4 simple (una etiqueta) — texto 10 bold centrado + 0,5 línea
pdfLabelBtn?.addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const humanId = labelIdText.textContent;
  const svgElement = barcodeSvg;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);

  const pageWidth = doc.internal.pageSize.getWidth();
  const textWidth = doc.getTextWidth(humanId);
  const textX = (pageWidth - textWidth) / 2;
  let y = 20;
  doc.text(humanId, textX, y);
  y += 3;

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const img = new Image();
  img.onload = () => {
    canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const bw = 50; const bh = (bw * img.height) / img.width;
    const bx = (pageWidth - bw) / 2;
    doc.addImage(dataUrl, 'PNG', bx, y, bw, bh);
    doc.save('etiqueta-' + humanId.replace('/', '-') + '.pdf');
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
});

// ========== Búsqueda ==========
searchForm?.addEventListener('submit', (e) => { e.preventDefault(); performSearch(); });
advancedSearchForm?.addEventListener('submit', (e) => { e.preventDefault(); performSearch(true); });
clearSearchBtn?.addEventListener('click', () => { searchForm?.reset(); searchResultsContainer.innerHTML = ''; });

async function performSearch(isAdvanced = false) {
  searchResultsContainer.innerHTML = '<p>Buscando...</p>';
  try {
    let base = db.collection('expedientes');

    if (isAdvanced) {
      const advValues = {
        'nomen.circunscripcion': $('#adv-nomen-circ')?.value || '',
        'nomen.seccion':         $('#adv-nomen-secc')?.value || '',
        'nomen.chacra':          $('#adv-nomen-chac')?.value || '',
        'nomen.quinta':          $('#adv-nomen-quin')?.value || '',
        'nomen.manzana':         $('#adv-nomen-manz')?.value || '',
        'nomen.parcela':         $('#adv-nomen-parc')?.value || '',
        'partidas.prov':         $('#adv-part-prov')?.value || '',
        'partidas.mun':          $('#adv-part-mun')?.value || '',
      };
      for (const k in advValues) { const v = advValues[k].trim(); if (v) base = base.where(k, '==', v); }
      const extracto = $('#search-extracto')?.value.trim();
      if (extracto) base = base.where('extracto', '>=', extracto).where('extracto', '<=', extracto + '\uf8ff');
      base = base.orderBy('createdAt', 'desc'); closeAllModals();
      const snap = await base.get(); return renderSearchResults(snap);
    }

    const codigo = $('#search-codigo')?.value.trim();
    const numero = $('#search-numero')?.value.trim();
    const letra  = ($('#search-letra')?.value || '').trim().toUpperCase();
    const anio   = $('#search-anio')?.value.trim();
    const extracto = $('#search-extracto')?.value.trim();

    if (!numero) {
      searchResultsContainer.innerHTML = `<p class="error-message">El campo <strong>Número</strong> es obligatorio.</p>`; return;
    }

    let q1 = base; if (codigo) q1 = q1.where('codigo','==',codigo);
    q1 = q1.where('numero','==',numero); if (letra) q1 = q1.where('letra','==',letra); if (anio) q1 = q1.where('anio','==',anio);
    if (extracto) q1 = q1.where('extracto','>=',extracto).where('extracto','<=',extracto+'\uf8ff');
    q1 = q1.orderBy('createdAt','desc');

    let snap = await q1.get();
    if (snap.empty && !isNaN(Number(numero))) {
      let q2 = base; if (codigo) q2 = q2.where('codigo','==',codigo);
      q2 = q2.where('numero','==',Number(numero)); if (letra) q2 = q2.where('letra','==',letra); if (anio) q2 = q2.where('anio','==',anio);
      if (extracto) q2 = q2.where('extracto','>=',extracto).where('extracto','<=',extracto+'\uf8ff');
      q2 = q2.orderBy('createdAt','desc'); try { snap = await q2.get(); } catch(e){ console.error(e); }
    }
    renderSearchResults(snap);
  } catch (e) {
    console.error(e);
    searchResultsContainer.innerHTML = `<p class="error-message">Error al buscar.</p>`;
  }
}

function formatDate(ts) {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth()+1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'); const ampm = h>=12?'pm':'am'; h = h%12 || 12;
  return `${dd}/${mm}/${yyyy} - ${h}:${m} ${ampm}`;
}

function renderSearchResults(qs) {
  if (qs.empty) { searchResultsContainer.innerHTML = '<p>No se encontraron expedientes.</p>'; return; }
  searchResultsContainer.innerHTML = '';
  let i = 0;
  qs.forEach(doc => {
    const data = doc.data();
    const id = `${data.codigo}-${data.numero}-${data.letra}-${data.anio}`;
    const fecha = data.createdAt ? formatDate(data.createdAt) : '—';
    const mov = (data.movimiento || data.ultimoMovimiento?.tipo || '').toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const cls = mov === 'recibimos' ? 'recibimos' : (mov === 'enviamos' ? 'enviamos' : '');
    const item = document.createElement('div');
    item.className = `result-item${i===0?' latest':''} ${cls}`;
    item.innerHTML = `
      ${i===0?'<span class="latest-badge">Último movimiento</span>':''}
      <strong>ID: ${id}</strong>
      <p class="meta"><strong>Fecha:</strong> ${fecha}</p>
      <p><strong>Extracto:</strong> ${data.extracto || ''}</p>
      <p><strong>Oficina:</strong> ${data.oficina || ''}</p>
      <p><strong>Movimiento:</strong> ${data.movimiento || data.ultimoMovimiento?.tipo || ''}</p>
      <p><strong>Autor:</strong> ${data.autor || ''}</p>
    `;
    searchResultsContainer.appendChild(item); i++;
  });
}

// ========== Escáner por cámara ==========
function stopMediaTracks(videoEl) {
  const stream = videoEl?.srcObject;
  if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
  if (videoEl) videoEl.srcObject = null;
}
let scanLock = false;
async function listVideoInputs() {
  const devs = await navigator.mediaDevices.enumerateDevices();
  return devs.filter(d => d.kind === 'videoinput');
}
async function initScanner(mode) {
  state.scannerMode = mode; openModal(scannerModal);
  const fb = document.getElementById('scanner-feedback');
  if (fb) fb.textContent = 'Solicitando acceso a la cámara…';
  scannerVideo?.setAttribute('playsinline','true');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:{ ideal:'environment' } } });
    scannerVideo.srcObject = stream; try{ await scannerVideo.play(); }catch(_){}
    if (fb) fb.textContent = 'Inicializando decodificador…';

    const ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
    state.scanner = new ZXing.BrowserMultiFormatReader();
    const inputs = await listVideoInputs(); cameraSelect.innerHTML='';
    inputs.forEach((d,i)=>{ const o=document.createElement('option'); o.value=d.deviceId; o.textContent=d.label||`Cámara ${i+1}`; cameraSelect.appendChild(o); });
    let prefer = inputs.find(d=>/back|rear|environment|trase/i.test(d.label));
    if (!prefer && inputs.length) prefer = inputs[inputs.length-1];
    stopMediaTracks(scannerVideo); scanLock=false;
    if (prefer) await startScanWithDevice(prefer.deviceId);
    else await startScanWithConstraints({ audio:false, video:{ facingMode:{ ideal:'environment' } } });
    if (fb) fb.textContent = '';
  } catch (err) {
    console.error(err);
    const fb2 = document.getElementById('scanner-feedback');
    if (fb2) fb2.textContent = 'Error al iniciar cámara. Revisá permisos del sitio.\n'+(err.name||err.message||'');
  }
}
async function startScanWithDevice(deviceId) {
  const ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
  if (!state.scanner) state.scanner = new ZXing.BrowserMultiFormatReader();
  stopMediaTracks(scannerVideo);
  await state.scanner.decodeFromVideoDevice(deviceId, scannerVideo, (result, err) => {
    if (result && !scanLock) { scanLock=true; handleScanResult(result.getText()); }
    if (err && err.constructor && err.constructor.name !== 'NotFoundException') console.warn('Decode error:', err);
  });
}
async function startScanWithConstraints(constraints) {
  const ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
  if (!state.scanner) state.scanner = new ZXing.BrowserMultiFormatReader();
  stopMediaTracks(scannerVideo);
  await state.scanner.decodeFromConstraints(constraints, scannerVideo, (result, err) => {
    if (result && !scanLock) { scanLock=true; handleScanResult(result.getText()); }
    if (err && err.constructor && err.constructor.name !== 'NotFoundException') console.warn('Decode error:', err);
  });
}
async function startScan(){ const id = cameraSelect.value; if (!id) return;
  const fb = document.getElementById('scanner-feedback');
  try { if (fb) fb.textContent='Cambiando cámara…'; scanLock=false; await startScanWithDevice(id); if (fb) fb.textContent=''; }
  catch(e){ if (fb) fb.textContent='No se pudo cambiar de cámara.'; }
}
function handleScanResult(text) {
  stopScanner();
  const p = text.split('-');
  if (p.length === 4) {
    if (state.scannerMode === 'carga') {
      $('#carga-codigo').value=p[0]; $('#carga-numero').value=p[1]; $('#carga-letra').value=p[2]; $('#carga-anio').value=p[3];
    } else if (state.scannerMode === 'busqueda') {
      $('#search-codigo').value=p[0]; $('#search-numero').value=p[1]; $('#search-letra').value=p[2]; $('#search-anio').value=p[3];
      performSearch();
    }
  } else { alert('Formato esperado: CODIGO-NUMERO-LETRA-AÑO'); }
}
function stopScanner(){ try{state.scanner?.reset();}catch(_){} stopMediaTracks(scannerVideo); closeAllModals(); }
scanCargaBtn?.addEventListener('click', ()=>initScanner('carga'));
scanBusquedaBtn?.addEventListener('click', ()=>initScanner('busqueda'));
cameraSelect?.addEventListener('change', startScan);

// ========== Modales ==========
function openModal(m){ if (!m) return; modalOverlay?.classList.remove('hidden'); m.classList.remove('hidden'); }
function closeAllModals(){
  modalOverlay?.classList.add('hidden');
  allModals.forEach(m=>m.classList.add('hidden'));
  try{ state.scanner?.reset(); }catch(_){} stopMediaTracks(scannerVideo);
}
settingsBtn?.addEventListener('click', ()=>openModal(settingsModal));
advancedSearchBtn?.addEventListener('click', ()=>openModal(advancedSearchModal));
closeModalBtn?.addEventListener('click', closeAllModals);
modalOverlay?.addEventListener('click', (e)=>{ if (e.target===modalOverlay) closeAllModals(); });
$$('.close-modal-btn').forEach(b=>b.addEventListener('click', closeAllModals));

// ========== ETIQUETAS (lote) UI ==========
function renderLabelsTable(){
  lblTableTB.innerHTML = '';
  labelsState.list.forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.codigo}</td>
      <td>${it.numero}</td>
      <td>${it.letra}</td>
      <td>${it.anio}</td>
      <td><button class="btn btn-sm btn-danger" data-idx="${idx}">❌</button></td>`;
    lblTableTB.appendChild(tr);
  });
  lblTableTB.querySelectorAll('button[data-idx]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const i = parseInt(e.currentTarget.dataset.idx,10);
      if (!isNaN(i)) { labelsState.list.splice(i,1); renderLabelsTable(); }
    });
  });
}
function addLabelRow({codigo, numero, letra, anio}){
  if (!codigo || !numero || !letra || !anio) return;
  const key = `${codigo}-${numero}-${letra}-${anio}`.toUpperCase();
  if (labelsState.list.some(x => `${x.codigo}-${x.numero}-${x.letra}-${x.anio}`.toUpperCase()===key)) return;
  labelsState.list.push({codigo, numero, letra, anio});
  renderLabelsTable();
}
lblAddBtn?.addEventListener('click', ()=>{
  addLabelRow({ codigo: lblCodigo.value.trim(), numero: lblNumero.value.trim(), letra: (lblLetra.value||'').toUpperCase(), anio: lblAnio.value.trim() });
  lblCodigo.value=lblNumero.value=lblLetra.value=lblAnio.value='';
  lblCodigo.focus();
});
lblClearBtn?.addEventListener('click', ()=>{
  if (!labelsState.list.length) return;
  if (confirm('¿Vaciar la lista de etiquetas?')) { labelsState.list = []; renderLabelsTable(); }
});

// ========== Generación de PDF múltiple (3 columnas x hasta 8 filas) ==========
async function svgToPngDataUrl(barcodeText){
  return new Promise(resolve=>{
    // usamos un SVG temporal
    const tmp = document.createElementNS('http://www.w3.org/2000/svg','svg');
    JsBarcode(tmp, barcodeText, { format:'CODE128', lineColor:'#000', width:1, height:28, displayValue:false, margin:4 });
    const svgData = new XMLSerializer().serializeToString(tmp);
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const img = new Image();
    img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img,0,0); resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.width, h: img.height }); };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  });
}

lblGenBtn?.addEventListener('click', async ()=>{
  if (!labelsState.list.length) { alert('La lista está vacía.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  doc.setFont('helvetica','bold'); doc.setFontSize(10);

  // Layout A4
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 10; // mm
  const gutter = 5;  // mm
  const cols = 3;
  const colW = (pageW - 2*margin - (cols-1)*gutter) / cols; // ~58mm
  const rowH = 30;   // alto por etiqueta
  const rowsPerPage = Math.floor((pageH - 2*margin + gutter) / (rowH + gutter)); // ~8

  for (let i = 0; i < labelsState.list.length; i++) {
    const item = labelsState.list[i];
    const human = `${item.codigo}-${item.numero}-${item.letra}/${item.anio}`;
    const code  = `${item.codigo}-${item.numero}-${item.letra}-${item.anio}`;

    const idx = i % (cols * rowsPerPage);
    const pageIdx = Math.floor(i / (cols * rowsPerPage));
    if (idx === 0 && pageIdx > 0) doc.addPage();

    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = margin + col * (colW + gutter);
    const y = margin + row * (rowH + gutter);

    // Texto centrado
    const tw = doc.getTextWidth(human);
    doc.text(human, x + (colW - tw)/2, y + 5);

    // Código de barras centrado (ancho 50mm o lo que quepa)
    const targetBW = Math.min(50, colW - 8);
    const { dataUrl, w, h } = await svgToPngDataUrl(code);
    const bH = (targetBW * h) / w;
    const bx = x + (colW - targetBW)/2;
    const by = y + 8; // ~0.5 línea debajo del texto
    doc.addImage(dataUrl, 'PNG', bx, by, targetBW, bH);
  }

  doc.save(`etiquetas-${labelsState.list.length}.pdf`);
});

// ========== Atajos ==========
document.addEventListener('keydown', (e) => {
  const inInput = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
  if (e.key === 'F2') { e.preventDefault(); switchTab('carga'); }
  if (e.ctrlKey && e.key === 'Enter') {
    if (!inInput || (cargaSection && !cargaSection.classList.contains('hidden'))) {
      e.preventDefault(); expedienteForm?.requestSubmit?.();
    }
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); switchTab('busqueda'); $('#search-numero')?.focus(); }
});

// Arranque
switchTab('carga');
