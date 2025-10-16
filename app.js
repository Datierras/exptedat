// app.js (FINAL)

// --- Inicialización de Firebase y Constantes Globales ---
// Usar la sintaxis v8 compatible con los scripts del HTML
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const Timestamp = firebase.firestore.Timestamp;

// Estado de la aplicación
const state = {
  currentUser: null,
  userProfile: { apodo: '' },
  scanner: null,
  scannerMode: null, // 'carga' o 'busqueda'
};

// --- Selectores del DOM ---
const $  = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const authContainer = $('#auth-container');
const appContainer  = $('#app-container');
const logoutBtn     = $('#logout-btn');
const loginForm     = $('#login-form');
const authError     = $('#auth-error');

const tabCarga      = $('#tab-carga');
const tabBusqueda   = $('#tab-busqueda');
const cargaSection  = $('#carga-section');
const busquedaSection = $('#busqueda-section');

const expedienteForm   = $('#expediente-form');
const saveExpedienteBtn= $('#save-expediente-btn');
const settingsBtn      = $('#settings-btn');

const modalOverlay     = $('#modal-overlay');
const allModals        = $$('.modal-content');
const settingsModal    = $('#settings-modal');
const saveSettingsBtn  = $('#save-settings-btn');
const userApodoInput   = $('#user-apodo');

const dropdown         = $('.custom-dropdown');
const dropdownToggle   = $('.dropdown-toggle');

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

const searchForm           = $('#search-form');
const searchResultsContainer = $('#search-results');
const clearSearchBtn       = $('#clear-search-btn');
const advancedSearchBtn    = $('#advanced-search-btn');
const advancedSearchModal  = $('#advanced-search-modal');
const advancedSearchForm   = $('#advanced-search-form');


// === Auto-completar y bloquear "Extracto" por defecto ===
(function setupExtractoAutofill(){
  const numeroInp   = document.getElementById('carga-numero');
  const letraInp    = document.getElementById('carga-letra');
  const anioInp     = document.getElementById('carga-anio');
  const extractoInp = document.getElementById('carga-extracto');

  if (!numeroInp || !letraInp || !anioInp || !extractoInp) return;

  // Crear botón "Editar extracto" si no existe
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

    // Intentar ambos formatos de 'numero' para compatibilidad
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
    // Si no hay historial, desbloquear
    lockExtracto(false);
}


  // Marcar si el usuario edita manualmente
  extractoInp.addEventListener('input', () => {
    extractoInp.dataset.userEdited = '1';
  });

  // Toggle lock
  toggleBtn.addEventListener('click', () => {
    const willLock = !extractoInp.readOnly;
    lockExtracto(willLock);
  });

  // Triggers para intentar autocompletar
  ['change','blur'].forEach(evt=>{
    numeroInp.addEventListener(evt, fetchLastExtracto);
    letraInp.addEventListener(evt, fetchLastExtracto);
    anioInp.addEventListener(evt, fetchLastExtracto);
  });

  // Al cargar la pestaña de carga, intentar autocompletar
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

logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

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

// --- Gestión de Perfil de Usuario (Apodo) ---
async function loadUserProfile() {
  if (!state.currentUser) return;
  const userDocRef = db.collection('usuarios').doc(state.currentUser.uid);
  const docSnap = await userDocRef.get();
  if (docSnap.exists) {
    state.userProfile = docSnap.data();
    userApodoInput.value = state.userProfile.apodo || '';
  }
}

saveSettingsBtn.addEventListener('click', async () => {
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
// --- SEARCH RZ14 --- //
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

    // 1) Intento con numero como STRING (recomendado)
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

    // 2) Si no hay resultados, intentamos con numero como NUMBER (para datos viejos mal tipados)
    if (snap.empty && !isNaN(Number(numero))) {
      let q2 = base;
      if (codigo) q2 = q2.where('codigo', '==', codigo);
      q2 = q2.where('numero', '==', Number(numero)); // número
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
        console.error('[search] fallo intento number (¿falta índice compuesto numero+createdAt?):', e2);
      }
    }

    renderSearchResults(snap);

  } catch (error) {
    console.error('Error en la búsqueda:', error);
    searchResultsContainer.innerHTML = `
      <p class="error-message">
        Error al buscar. Es posible que necesites crear un <strong>índice compuesto</strong> en Firestore.
        Abrí la consola (F12) y seguí el enlace que te da Firestore.
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

tabCarga.addEventListener('click', () => switchTab('carga'));
tabBusqueda.addEventListener('click', () => switchTab('busqueda'));

// --- Lógica de la Sección de CARGA ---
dropdownToggle.addEventListener('click', () => {
  dropdown.classList.toggle('open');
});

expedienteForm.addEventListener('submit', async (e) => {
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
    await db.collection('expedientes').add(expedienteData);
    alert('Expediente guardado con éxito.');
    expedienteForm.reset();
    dropdown.classList.remove('open');
  } catch (error) {
    console.error('Error al guardar el expediente: ', error);
    alert('Hubo un error al guardar. Inténtalo de nuevo.');
  } finally {
    saveExpedienteBtn.disabled = false;
    saveExpedienteBtn.textContent = 'Guardar expediente';
  }
});

// --- Lógica de Etiquetas y PDF ---
generateLabelBtn.addEventListener('click', () => {
  const codigo = $('#carga-codigo').value;
  const numero = $('#carga-numero').value;
  const letra  = $('#carga-letra').value.toUpperCase();
  const anio   = $('#carga-anio').value;

  if (!codigo || !numero || !letra || !anio) {
    alert('Completa los campos Código, Número, Letra y Año para generar la etiqueta.');
    return;
  }

  const fullId = `${codigo}-${numero}-${letra}-${anio}`;
  labelIdText.textContent = fullId;

  JsBarcode(barcodeSvg, fullId, {
    format: "CODE128",
    lineColor: "#000",
    width: 2,
    height: 50,
    displayValue: false
  });

  openModal(labelModal);
});

printLabelBtn.addEventListener('click', () => {
  const labelContent = $('#label-content').innerHTML;
  const printWindow = window.open('', '', 'height=400,width=600');
  printWindow.document.write('<html><head><title>Imprimir Etiqueta</title>');
  printWindow.document.write('<style>body{text-align:center;font-family:sans-serif;} svg{width:80%;}</style>');
  printWindow.document.write('</head><body>');
  printWindow.document.write(labelContent);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
});

pdfLabelBtn.addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const fullId = labelIdText.textContent;
  const svgElement = barcodeSvg;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a6'
  });

  doc.setFontSize(16);
  doc.text('Etiqueta de Expediente', 74, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.text(fullId, 74, 25, { align: 'center' });

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');

    const barcodeWidth = 90;
    const barcodeHeight = (barcodeWidth * img.height) / img.width;
    const x = (148 - barcodeWidth) / 2;
    doc.addImage(dataUrl, 'PNG', x, 40, barcodeWidth, barcodeHeight);

    doc.save(`etiqueta-${fullId}.pdf`);
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
});

// --- Lógica de Búsqueda ---
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  performSearch();
});

advancedSearchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  performSearch(true);
});

// --- Botón Limpiar (mantener) ---
clearSearchBtn.addEventListener('click', () => {
  searchForm.reset();
  searchResultsContainer.innerHTML = '';
});

// --- NUEVO: formateador de fecha para mostrar createdAt ---
function formatDate(ts) {
  // Acepta Timestamp de Firestore o Date/number
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

// --- ÚNICA función renderSearchResults (con fecha + destacado) ---
function renderSearchResults(querySnapshot) {
  if (querySnapshot.empty) {
    searchResultsContainer.innerHTML = '<p>No se encontraron expedientes.</p>';
    return;
  }

  // Docs ya vienen DESC por createdAt → primero = último movimiento
  searchResultsContainer.innerHTML = '';
  let i = 0;

  querySnapshot.forEach(doc => {
    const data = doc.data();
    const idCompleto = `${data.codigo}-${data.numero}-${data.letra}-${data.anio}`;
    const fecha = data.createdAt ? formatDate(data.createdAt) : '—';

    const item = document.createElement('div');
    item.className = 'result-item' + (i === 0 ? ' latest' : '');

    item.innerHTML = `
      ${i === 0 ? '<span class="latest-badge">Último movimiento</span>' : ''}
      <strong>ID: ${idCompleto}</strong>
      <p class="meta"><strong>Fecha:</strong> ${fecha}</p>
      <p><strong>Extracto:</strong> ${data.extracto || ''}</p>
      <p><strong>Oficina:</strong> ${data.oficina || ''}</p>
      <p><strong>Movimiento:</strong> ${data.movimiento || ''}</p>
      <p><strong>Autor:</strong> ${data.autor || ''}</p>
    `;

    searchResultsContainer.appendChild(item);
    i++;
  });
}


// --- Escáner (móvil robusto: permiso previo + trasera + fallback) ---
// Utilidad: detener tracks de un <video>
function stopMediaTracks(videoEl) {
  const stream = videoEl.srcObject;
  if (stream && stream.getTracks) {
    stream.getTracks().forEach(t => t.stop());
  }
  videoEl.srcObject = null;
}

// Inicializa el escáner y fuerza cámara trasera con fallback
// --- Escáner (móvil robusto) ---
let scanLock = false; // evita disparar dos veces

function stopMediaTracks(videoEl) {
  const stream = videoEl.srcObject;
  if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
  videoEl.srcObject = null;
}

async function listVideoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}

async function initScanner(mode) {
  state.scannerMode = mode;
  openModal(scannerModal);

  const feedback = document.getElementById('scanner-feedback');
  if (feedback) feedback.textContent = 'Solicitando acceso a la cámara…';

  // hint para iOS
  if (scannerVideo) scannerVideo.setAttribute('playsinline', 'true');

  // Primero pedimos permiso para que enumerateDevices devuelva labels en iOS
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

    // Listar cámaras con enumerateDevices (no usar listVideoInputDevices en la instancia)
    const videoInputs = await listVideoInputs();
    cameraSelect.innerHTML = '';
    videoInputs.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Cámara ${i + 1}`;
      cameraSelect.appendChild(opt);
    });

    // Elegir trasera si se reconoce, si no la última
    let preferred = videoInputs.find(d => /back|rear|environment|trase/i.test(d.label));
    if (!preferred && videoInputs.length) preferred = videoInputs[videoInputs.length - 1];

    // Reiniciamos stream del video (vamos a dejar que ZXing lo gestione)
    stopMediaTracks(scannerVideo);

    // Arrancar decodificación
    scanLock = false;
    if (preferred) {
      await startScanWithDevice(preferred.deviceId);
    } else {
      // fallback: constraints por facingMode
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

  // Asegurarnos de no dejar streams colgando
  stopMediaTracks(scannerVideo);

  await state.scanner.decodeFromVideoDevice(deviceId, scannerVideo, (result, err) => {
    if (result && !scanLock) {
      scanLock = true;
      handleScanResult(result.getText());
    }
    if (err && err.constructor && err.constructor.name !== 'NotFoundException') {
      // Errores de decodificación distintos a "no encontrado" (normales mientras busca)
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

scanCargaBtn.addEventListener('click', () => initScanner('carga'));
scanBusquedaBtn.addEventListener('click', () => initScanner('busqueda'));
cameraSelect.addEventListener('change', startScan);

// --- Lógica de Modales ---
function openModal(modal) {
  modalOverlay.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function closeAllModals() {
  modalOverlay.classList.add('hidden');
  allModals.forEach(modal => modal.classList.add('hidden'));
  try { state.scanner?.reset(); } catch (_) {}
  if (scannerVideo) {
    try { stopMediaTracks(scannerVideo); } catch (_) {}
    scannerVideo.srcObject = null;
  }
}

settingsBtn.addEventListener('click', () => openModal(settingsModal));
advancedSearchBtn.addEventListener('click', () => openModal(advancedSearchModal));
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    closeAllModals();
  }
});
$$('.close-modal-btn').forEach(btn => {
  btn.addEventListener('click', closeAllModals);
});

// Inicializar la app en la pestaña de carga
switchTab('carga');
