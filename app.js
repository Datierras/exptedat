// app.js (FINAL con ENVÍO GRUPAL en modal + Firebase config)

// --- Firebase config (TU PROYECTO) ---
const firebaseConfig = {
  apiKey: "AIzaSyAHXCfXoJK1p_naZf5v0_cAa6cphX1e1E8",
  authDomain: "exptcoord.firebaseapp.com",
  projectId: "exptcoord",
  storageBucket: "exptcoord.firebasestorage.app",
  messagingSenderId: "416639039117",
  appId: "1:416639039117:web:d9422f6d853a760a3014c4",
  measurementId: "G-94PRRLFZV4"
};

// --- Inicialización de Firebase (API v8 global) ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const Timestamp = firebase.firestore.Timestamp;

// Estado de la aplicación
const state = {
  currentUser: null,
  userProfile: { apodo: '' },
  scanner: null,
  scannerMode: null, // 'carga' | 'busqueda'
};

// --- Selectores del DOM ---
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const authContainer = $('#auth-container');
const appContainer  = $('#app-container');
const logoutBtn     = $('#logout-btn');
const loginForm     = $('#login-form');
const authError     = $('#auth-error');

const tabCarga        = $('#tab-carga');
const tabBusqueda     = $('#tab-busqueda');
const cargaSection    = $('#carga-section');
const busquedaSection = $('#busqueda-section');

const expedienteForm     = $('#expediente-form');
const saveExpedienteBtn  = $('#save-expediente-btn');
const settingsBtn        = $('#settings-btn');

const modalOverlay    = $('#modal-overlay');
const allModals       = $$('.modal-content');
const settingsModal   = $('#settings-modal');
const advancedSearchModal = $('#advanced-search-modal');

const saveSettingsBtn = $('#save-settings-btn');
const userApodoInput  = $('#user-apodo');

const dropdown        = $('.custom-dropdown');
const dropdownToggle  = $('.dropdown-toggle');

const generateLabelBtn = $('#generate-label-btn');
const labelModal       = $('#label-modal');
const labelIdText      = $('#label-id-text');
const barcodeSvg       = $('#barcode');
const printLabelBtn    = $('#print-label-btn');
const pdfLabelBtn      = $('#pdf-label-btn');

const scanCargaBtn     = $('#scan-carga-btn');
const scanBusquedaBtn  = $('#scan-busqueda-btn');
const scannerModal     = $('#scanner-modal');
const scannerVideo     = $('#scanner-video');
const cameraSelect     = $('#camera-select');

const searchForm             = $('#search-form');
const searchResultsContainer = $('#search-results');
const clearSearchBtn         = $('#clear-search-btn');
const advancedSearchBtn      = $('#advanced-search-btn');
const advancedSearchForm     = $('#advanced-search-form');

// NUEVO: Envío grupal (modal)
const openEnvioModalBtn = $('#open-envio-modal-btn'); // botón en action-buttons
const envioModal        = $('#envio-modal');           // modal con contenido de envío grupal

// === Auto-completar y bloquear "Extracto" por defecto ===
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
      } catch(err){
        console.warn('[extracto-autofill] intento fallido', err);
      }
    }
    lockExtracto(false);
  }

  extractoInp.addEventListener('input', () => {
    extractoInp.dataset.userEdited = '1';
  });

  toggleBtn.addEventListener('click', () => {
    const willLock = !extractoInp.readOnly;
    lockExtracto(willLock);
  });

  ['change','blur'].forEach(evt=>{
    numeroInp.addEventListener(evt, fetchLastExtracto);
    letraInp.addEventListener(evt, fetchLastExtracto);
    anioInp.addEventListener(evt, fetchLastExtracto);
  });

  document.addEventListener('DOMContentLoaded', fetchLastExtracto);
})();

// --- Lógica de Autenticación ---
auth.onAuthStateChanged(user => {
  if (user) {
    state.currentUser = user;
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loadUserProfile();

    const root = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');

    if (themeToggle) {
      const savedTheme = localStorage.getItem('theme') || 'light';
      root.setAttribute('data-theme', savedTheme);
      themeToggle.textContent = savedTheme === 'dark' ? '🌣' : '☾';
      themeToggle.onclick = null;
      themeToggle.addEventListener('click', () => {
        const current = root.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggle.textContent = next === 'dark' ? '🌣' : '☾';
      });
    }
  } else {
    state.currentUser = null;
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value;
  const password = $('#login-password').value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    authError.textContent = '';
    loginForm.reset();
  } catch (error) {
    handleAuthError(error);
  }
});

logoutBtn.addEventListener('click', () => auth.signOut());

function handleAuthError(error) {
  switch (error.code) {
    case 'auth/invalid-email':
      authError.textContent = 'El formato del correo es inválido.';
      break;
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      authError.textContent = 'Correo o contraseña incorrectos.';
      break;
    case 'auth/too-many-requests':
      authError.textContent = 'Demasiados intentos. Inténtalo más tarde.';
      break;
    default:
      authError.textContent = 'Ocurrió un error inesperado.';
      break;
  }
}

// --- Perfil de Usuario ---
async function loadUserProfile() {
  if (!state.currentUser) return;
  const userDocRef = db.collection('usuarios').doc(state.currentUser.uid);
  const docSnap = await userDocRef.get();
  if (docSnap.exists) {
    state.userProfile = docSnap.data();
    userApodoInput.value = state.userProfile.apodo || '';

    const sel = document.querySelector('#carga-oficina');
    if (sel && state.userProfile.ultimaOficina) {
      sel.value = state.userProfile.ultimaOficina;
    }
  }
}

saveSettingsBtn?.addEventListener('click', async () => {
  if (!state.currentUser) return;
  const apodo = userApodoInput.value.trim();
  const userDocRef = db.collection('usuarios').doc(state.currentUser.uid);
  try {
    await userDocRef.set({ apodo }, { merge: true });
    state.userProfile.apodo = apodo;
    alert('Apodo guardado correctamente.');
    closeAllModals();
  } catch (error) {
    console.error("Error guardando el apodo: ", error);
    alert('No se pudo guardar el apodo.');
  }
});

// --- SEARCH RZ14 ---
async function performSearch(isAdvanced = false) {
  console.log('[search] start, isAdvanced =', isAdvanced);
  searchResultsContainer.innerHTML = '<p>Buscando...</p>';

  try {
    let base = db.collection('expedientes');

    if (isAdvanced) {
      console.log('[search] avanzada');
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
      for (const key in advValues) {
        const val = advValues[key].trim();
        if (val) base = base.where(key, '==', val);
      }
      const extracto = $('#search-extracto')?.value.trim();
      if (extracto) {
        base = base.where('extracto', '>=', extracto)
                   .where('extracto', '<=', extracto + '\uf8ff');
      }
      base = base.orderBy('createdAt', 'desc');
      closeAllModals();

      const snap = await base.get();
      console.log('[search] avanzada, size=', snap.size);
      return renderSearchResults(snap);
    }

    // Búsqueda normal
    const codigo = $('#search-codigo')?.value.trim();
    const numero = $('#search-numero')?.value.trim();
    const letra  = ($('#search-letra')?.value || '').trim().toUpperCase();
    const anio   = $('#search-anio')?.value.trim();
    const extracto = $('#search-extracto')?.value.trim();

    if (!numero) {
      searchResultsContainer.innerHTML = `
        <p class="error-message">
          Para la búsqueda normal, el campo <strong>Número</strong> es obligatorio. 
          Usá <strong>Búsqueda Avanzada</strong> si no tenés el número.
        </p>`;
      console.warn('[search] falta numero');
      return;
    }

    let q1 = base;
    if (codigo) q1 = q1.where('codigo', '==', codigo);
    q1 = q1.where('numero', '==', numero);
    if (letra)  q1 = q1.where('letra',  '==', letra);
    if (anio)   q1 = q1.where('anio',   '==', anio);
    if (extracto) {
      q1 = q1.where('extracto', '>=', extracto)
             .where('extracto', '<=', extracto + '\uf8ff');
    }
    q1 = q1.orderBy('createdAt', 'desc');

    let snap = await q1.get();
    console.log('[search] intento string, size=', snap.size);

    if (snap.empty && !isNaN(Number(numero))) {
      let q2 = base;
      if (codigo) q2 = q2.where('codigo', '==', codigo);
      q2 = q2.where('numero', '==', Number(numero));
      if (letra)  q2 = q2.where('letra',  '==', letra);
      if (anio)   q2 = q2.where('anio',   '==', anio);
      if (extracto) {
        q2 = q2.where('extracto', '>=', extracto)
               .where('extracto', '<=', extracto + '\uf8ff');
      }
      q2 = q2.orderBy('createdAt', 'desc');

      try {
        const snap2 = await q2.get();
        console.log('[search] intento number, size=', snap2.size);
        snap = snap2;
      } catch (e2) {
        console.error('[search] fallo intento number:', e2);
      }
    }

    renderSearchResults(snap);

  } catch (error) {
    console.error('Error en la búsqueda:', error);
    searchResultsContainer.innerHTML = `
      <p class="error-message">
        Error al buscar. Puede requerirse un <strong>índice compuesto</strong> en Firestore.
        Revisá la consola (F12) para el enlace sugerido.
      </p>`;
  }
}

// --- Navegación por Pestañas ---
function switchTab(activeTab) {
  const tabs = [tabCarga, tabBusqueda];
  const sections = [cargaSection, busquedaSection];

  tabs.forEach(tab => tab.classList.remove('active'));
  sections.forEach(section => section.classList.add('hidden'));

  if (activeTab === 'carga') {
    tabCarga.classList.add('active');
    cargaSection.classList.remove('hidden');
  } else {
    tabBusqueda.classList.add('active');
    busquedaSection.classList.remove('hidden');
  }
}

tabCarga?.addEventListener('click', () => switchTab('carga'));
tabBusqueda?.addEventListener('click', () => switchTab('busqueda'));

// --- CARGA (form principal) ---
dropdownToggle?.addEventListener('click', () => {
  dropdown?.classList.toggle('open');
});

expedienteForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveExpedienteBtn.disabled = true;
  saveExpedienteBtn.textContent = 'Guardando...';

  const autor = state.userProfile.apodo || state.currentUser.email;

  const expedienteData = {
    codigo: $('#carga-codigo').value,
    numero: $('#carga-numero').value,
    letra: $('#carga-letra').value.toUpperCase(),
    anio: $('#carga-anio').value,
    extracto: $('#carga-extracto').value,
    oficina: $('#carga-oficina').value,
    movimiento: $('input[name="movimiento"]:checked').value,
    autor,
    createdAt: Timestamp.now(),
    nomen: {
      circunscripcion: $('#nomen-circ').value,
      seccion: $('#nomen-secc').value,
      chacra: $('#nomen-chac').value,
      l_ch: $('#nomen-lch').value,
      quinta: $('#nomen-quin').value,
      l_qt: $('#nomen-lqt').value,
      fraccion: $('#nomen-frac').value,
      l_fr: $('#nomen-lfr').value,
      manzana: $('#nomen-manz').value,
      l_mz: $('#nomen-lmz').value,
      parcela: $('#nomen-parc').value,
      l_pc: $('#nomen-lpc').value,
    },
    partidas: {
      prov: $('#part-prov').value,
      mun: $('#part-mun').value,
    }
  };

  if (!expedienteData.oficina) {
    alert("Por favor, selecciona una oficina.");
    saveExpedienteBtn.disabled = false;
    saveExpedienteBtn.textContent = 'Guardar expediente';
    return;
  }

  try {
    await db.collection('usuarios').doc(state.currentUser.uid)
      .set({ ultimaOficina: expedienteData.oficina }, { merge: true });
  } catch(_) {}

  try {
    await db.collection('expedientes').add(expedienteData);
    alert('Expediente guardado con éxito.');
    expedienteForm.reset();
    dropdown?.classList.remove('open');
  } catch (error) {
    console.error('Error al guardar el expediente: ', error);
    alert('Hubo un error al guardar. Inténtalo de nuevo.');
  } finally {
    saveExpedienteBtn.disabled = false;
    saveExpedienteBtn.textContent = 'Guardar expediente';
  }
});

// === Distribución automática de lecturas del lector USB (HID) ===
const EXP_SCAN_RE = /^(\d+)[-']?(\d+)[-']?([A-Za-z])[-/'"]?(\d{4})$/;

// Rellena los 4 campos de una sección (prefix = 'carga'|'search'|'envio')
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

  if (prefix === 'envio') {
    addExpToEnvioLista({ codigo: c, numero: n, letra: l, anio: a });

    const ec = document.querySelector('#envio-codigo');
    const en = document.querySelector('#envio-numero');
    const el = document.querySelector('#envio-letra');
    const ea = document.querySelector('#envio-anio');
    setTimeout(() => {
      if (ec) ec.value = '';
      if (en) en.value = '';
      if (el) el.value = '';
      if (ea) ea.value = '';
      ec?.focus();
    }, 30);
  }

  const codeId = `${prefix}-codigo`;
  if (srcEl && srcEl.id !== codeId) {
    srcEl.value = '';
  } else if (srcEl && srcEl.id === codeId) {
    srcEl.value = c;
  }

  const next = (prefix === 'carga') ? '#carga-extracto'
            : (prefix === 'search') ? '#search-extracto'
            : '#envio-codigo';
  document.querySelector(next)?.focus();

  if (prefix === 'search') {
    try { searchForm?.requestSubmit?.(); } catch(_) {}
  }

  return true;
}

function attachScanHandlersFor(prefix) {
  const selectors = [
    `#${prefix}-codigo`,
    `#${prefix}-numero`,
    `#${prefix}-letra`,
    `#${prefix}-anio`
  ];

  selectors.forEach(sel => {
    const el = document.querySelector(sel);
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

    el.addEventListener('change', () => {
      distributeTo(prefix, el.value, el);
    });
  });
}

attachScanHandlersFor('carga');
attachScanHandlersFor('search');
attachScanHandlersFor('envio');

// --- Etiquetas y PDF (Code128, ancho máx. 50mm) ---
generateLabelBtn?.addEventListener('click', () => {
  const codigo = $('#carga-codigo').value.trim();
  const numero = $('#carga-numero').value.trim();
  const letra  = ($('#carga-letra').value || '').trim().toUpperCase();
  const anio   = $('#carga-anio').value.trim();

  if (!codigo || !numero || !letra || !anio) {
    alert('Completa Código, Número, Letra y Año para generar la etiqueta.');
    return;
  }

  const humanId   = `${codigo}-${numero}-${letra}/${anio}`;
  const barcodeId = `${codigo}-${numero}-${letra}-${anio}`;

  labelIdText.textContent = humanId;

  barcodeSvg.style.width  = '50mm';
  barcodeSvg.style.height = 'auto';
  barcodeSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  JsBarcode(barcodeSvg, barcodeId, {
    format: "CODE128",
    lineColor: "#000",
    width: 1,
    height: 28,
    displayValue: false,
    margin: 4
  });

  openModal(labelModal);
});

printLabelBtn?.addEventListener('click', () => {
  const labelContent = $('#label-content').innerHTML;
  const win = window.open('', '', 'height=400,width=600');
  win.document.write('<html><head><title>Imprimir Etiqueta</title>');
  win.document.write('<style>body{text-align:center;font-family:sans-serif;} #barcode{width:50mm;height:auto;} svg{width:50mm !important;height:auto !important;}</style>');
  win.document.write('</head><body>');
  win.document.write(labelContent);
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  win.print();
  win.close();
});

pdfLabelBtn?.addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const humanId = labelIdText.textContent;
  const svgElement = barcodeSvg;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a6' });
  doc.setFontSize(14);
  doc.text('Etiqueta de Expediente', 74, 14, { align: 'center' });
  doc.setFontSize(12);
  doc.text(humanId, 74, 22, { align: 'center' });

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');

    const barcodeWidth = 50; // mm (tope)
    const barcodeHeight = (barcodeWidth * img.height) / img.width;
    const pageW = 148; // A6 landscape
    const x = (pageW - barcodeWidth) / 2;

    doc.addImage(dataUrl, 'PNG', x, 36, barcodeWidth, barcodeHeight);
    const filename = 'etiqueta-' + humanId.replace('/', '-') + '.pdf';
    doc.save(filename);
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
});

// --- Búsqueda (submit) ---
searchForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  performSearch();
});
advancedSearchForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  performSearch(true);
});
clearSearchBtn?.addEventListener('click', () => {
  searchForm?.reset();
  searchResultsContainer.innerHTML = '';
});

// --- Mostrar resultados ---
function formatDate(ts) {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${dd}/${mm}/${yyyy} - ${hours}:${minutes} ${ampm}`;
}

function renderSearchResults(querySnapshot) {
  if (querySnapshot.empty) {
    searchResultsContainer.innerHTML = '<p>No se encontraron expedientes.</p>';
    return;
  }

  searchResultsContainer.innerHTML = '';
  let i = 0;

  querySnapshot.forEach(doc => {
    const data = doc.data();
    const idCompleto = `${data.codigo}-${data.numero}-${data.letra}-${data.anio}`;
    const fecha = data.createdAt ? formatDate(data.createdAt) : '—';

    const movimientoRaw = (data.movimiento || data.ultimoMovimiento?.tipo || '').toString();
    const movimiento = movimientoRaw
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();

    let estadoClase = '';
    if (movimiento === 'recibimos') estadoClase = 'recibimos';
    else if (movimiento === 'enviamos') estadoClase = 'enviamos';

    const item = document.createElement('div');
    item.className = `result-item${i === 0 ? ' latest' : ''} ${estadoClase}`;

    item.innerHTML = `
      ${i === 0 ? '<span class="latest-badge">Último movimiento</span>' : ''}
      <strong>ID: ${idCompleto}</strong>
      <p class="meta"><strong>Fecha:</strong> ${fecha}</p>
      <p><strong>Extracto:</strong> ${data.extracto || ''}</p>
      <p><strong>Oficina:</strong> ${data.oficina || ''}</p>
      <p><strong>Movimiento:</strong> ${data.movimiento || data.ultimoMovimiento?.tipo || ''}</p>
      <p><strong>Autor:</strong> ${data.autor || ''}</p>
    `;
    searchResultsContainer.appendChild(item);
    i++;
  });
}

// --- Escáner por cámara (ZXing) ---
function stopMediaTracks(videoEl) {
  const stream = videoEl?.srcObject;
  if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
  if (videoEl) videoEl.srcObject = null;
}

let scanLock = false;

async function listVideoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}

async function initScanner(mode) {
  state.scannerMode = mode;
  openModal(scannerModal);

  const feedback = document.getElementById('scanner-feedback');
  if (feedback) feedback.textContent = 'Solicitando acceso a la cámara…';

  if (scannerVideo) scannerVideo.setAttribute('playsinline', 'true');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } }
    });
    scannerVideo.srcObject = stream;
    try { await scannerVideo.play(); } catch (_) {}

    if (feedback) feedback.textContent = 'Inicializando decodificador…';

    const ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
    state.scanner = new ZXing.BrowserMultiFormatReader();

    const videoInputs = await listVideoInputs();
    cameraSelect.innerHTML = '';
    videoInputs.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Cámara ${i + 1}`;
      cameraSelect.appendChild(opt);
    });

    let preferred = videoInputs.find(d => /back|rear|environment|trase/i.test(d.label));
    if (!preferred && videoInputs.length) preferred = videoInputs[videoInputs.length - 1];

    stopMediaTracks(scannerVideo);

    scanLock = false;
    if (preferred) {
      await startScanWithDevice(preferred.deviceId);
    } else {
      await startScanWithConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } });
    }
    if (feedback) feedback.textContent = '';
  } catch (err) {
    console.error('getUserMedia error:', err);
    const reason = (err && (err.name || err.message)) ? `${err.name}: ${err.message}` : 'Error desconocido';
    const feedback = document.getElementById('scanner-feedback');
    if (feedback) feedback.textContent = 'Error al iniciar la cámara. Revisá permisos del navegador para esta página.\n' + reason;
  }
}

async function startScanWithDevice(deviceId) {
  const ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
  if (!state.scanner) state.scanner = new ZXing.BrowserMultiFormatReader();

  stopMediaTracks(scannerVideo);

  await state.scanner.decodeFromVideoDevice(deviceId, scannerVideo, (result, err) => {
    if (result && !scanLock) {
      scanLock = true;
      handleScanResult(result.getText());
    }
    if (err && err.constructor && err.constructor.name !== 'NotFoundException') {
      console.warn('Decode error:', err);
    }
  });
}

async function startScanWithConstraints(constraints) {
  const ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
  if (!state.scanner) state.scanner = new ZXing.BrowserMultiFormatReader();

  stopMediaTracks(scannerVideo);

  await state.scanner.decodeFromConstraints(constraints, scannerVideo, (result, err) => {
    if (result && !scanLock) {
      scanLock = true;
      handleScanResult(result.getText());
    }
    if (err && err.constructor && err.constructor.name !== 'NotFoundException') {
      console.warn('Decode error:', err);
    }
  });
}

async function startScan() {
  const id = cameraSelect.value;
  if (!id) return;
  const fb = document.getElementById('scanner-feedback');
  try {
    if (fb) fb.textContent = 'Cambiando de cámara…';
    scanLock = false;
    await startScanWithDevice(id);
    if (fb) fb.textContent = '';
  } catch (e) {
    console.error(e);
    if (fb) fb.textContent = 'No se pudo cambiar de cámara.';
  }
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
      performSearch();
    }
  } else {
    alert('Código no reconocido. Formato esperado: CODIGO-NUMERO-LETRA-AÑO');
  }
}

function stopScanner() {
  try { state.scanner?.reset(); } catch(_) {}
  stopMediaTracks(scannerVideo);
  closeAllModals();
}

scanCargaBtn?.addEventListener('click', () => initScanner('carga'));
scanBusquedaBtn?.addEventListener('click', () => initScanner('busqueda'));
cameraSelect?.addEventListener('change', startScan);

// --- Modales (incluye ENVÍO GRUPAL modal) ---
function openModal(modal) {
  if (!modal) return;
  modalOverlay?.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function closeAllModals() {
  modalOverlay?.classList.add('hidden');
  allModals.forEach(m => m.classList.add('hidden'));
  try { state.scanner?.reset(); } catch (_) {}
  if (scannerVideo) {
    try { stopMediaTracks(scannerVideo); } catch (_) {}
    scannerVideo.srcObject = null;
  }
}

settingsBtn?.addEventListener('click', () => openModal(settingsModal));
advancedSearchBtn?.addEventListener('click', () => openModal(advancedSearchModal));
openEnvioModalBtn?.addEventListener('click', () => openModal(envioModal));

modalOverlay?.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeAllModals();
});
$$('.close-modal-btn').forEach(btn => btn.addEventListener('click', closeAllModals));

// === ENVÍO GRUPAL / MASIVO (lógica) ===
const envio = {
  lista: [],
  tablaBody: document.querySelector('#tabla-envios tbody'),
  codigo: document.querySelector('#envio-codigo'),
  numero: document.querySelector('#envio-numero'),
  letra:  document.querySelector('#envio-letra'),
  anio:   document.querySelector('#envio-anio'),
  oficina: document.querySelector('#envio-oficina-select'),
  btnAgregar: document.querySelector('#agregar-expediente'),
  btnConfirmar: document.querySelector('#confirmar-envio-btn'),
};

function renderEnvioTabla() {
  if (!envio.tablaBody) return;
  envio.tablaBody.innerHTML = '';
  envio.lista.forEach((exp, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${exp.codigo}</td>
      <td>${exp.numero}</td>
      <td>${exp.letra}</td>
      <td>${exp.anio}</td>
      <td><button class="btn btn-sm btn-danger btn-eliminar" data-idx="${idx}" title="Quitar">❌</button></td>
    `;
    envio.tablaBody.appendChild(tr);
  });

  envio.tablaBody.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx, 10);
      if (!isNaN(idx)) {
        envio.lista.splice(idx, 1);
        renderEnvioTabla();
      }
    });
  });
}

function addExpToEnvioLista({ codigo, numero, letra, anio }) {
  if (!codigo || !numero || !letra || !anio) return;
  const key = `${codigo}-${numero}-${(letra || '').toUpperCase()}-${anio}`.toUpperCase();
  const exists = envio.lista.some(x =>
    `${x.codigo}-${x.numero}-${x.letra}-${x.anio}`.toUpperCase() === key
  );
  if (exists) return; // evitar duplicados exactos
  envio.lista.push({ codigo, numero, letra: (letra || '').toUpperCase(), anio });
  renderEnvioTabla();
}

envio.btnAgregar?.addEventListener('click', () => {
  addExpToEnvioLista({
    codigo: (envio.codigo?.value || '').trim(),
    numero: (envio.numero?.value || '').trim(),
    letra:  (envio.letra?.value  || '').trim(),
    anio:   (envio.anio?.value   || '').trim(),
  });
  if (envio.codigo) envio.codigo.value = '';
  if (envio.numero) envio.numero.value = '';
  if (envio.letra)  envio.letra.value  = '';
  if (envio.anio)   envio.anio.value   = '';
  envio.codigo?.focus();
});

envio.btnConfirmar?.addEventListener('click', async () => {
  const oficina = envio.oficina?.value || '';
  if (!oficina) return alert('Seleccioná una oficina de destino.');
  if (!envio.lista.length) return alert('No hay expedientes cargados.');

  const ok = confirm(`¿Confirmar envío de ${envio.lista.length} expedientes a "${oficina}"?`);
  if (!ok) return;

  try {
    const batch = db.batch();
    const autor = state.userProfile?.apodo || state.currentUser?.email || 'sistema';

    envio.lista.forEach(exp => {
      const ref = db.collection('expedientes').doc();
      batch.set(ref, {
        codigo: exp.codigo,
        numero: exp.numero,
        letra: exp.letra,
        anio: exp.anio,
        movimiento: 'Enviamos',
        oficina,
        autor,
        createdAt: Timestamp.now()
      });
    });

    await batch.commit();
    alert(`Se enviaron ${envio.lista.length} expedientes a ${oficina}.`);
    envio.lista = [];
    renderEnvioTabla();
    envio.codigo?.focus();
  } catch (err) {
    console.error('Error en envío grupal:', err);
    alert('Error al registrar los envíos. Revisá la consola para más detalles.');
  }
});

// --- Atajos útiles ---
document.addEventListener('keydown', (e) => {
  const inInput = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');

  if (e.key === 'F2') {
    e.preventDefault();
    switchTab('carga');
    initScanner('carga');
  }

  if (e.ctrlKey && e.key === 'Enter') {
    if (!inInput || (cargaSection && !cargaSection.classList.contains('hidden'))) {
      e.preventDefault();
      expedienteForm?.requestSubmit?.();
    }
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    switchTab('busqueda');
    document.querySelector('#search-numero')?.focus();
  }
});

// Inicializar en CARGA
switchTab('carga');

