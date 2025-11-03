// app.js — Gestión de Expedientes (tema SVG + modales + escáner + etiquetas múltiple + envío grupal)

// ===========================
// Firebase (Compat v9 estilo v8)
// ===========================
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
const db = firebase.firestore();
const Timestamp = firebase.firestore.Timestamp;

// ===========================
// Estado + helpers DOM
// ===========================
const state = {
  currentUser: null,
  userProfile: { apodo: "" },
  scanner: null,
  scannerMode: null, // 'carga' | 'busqueda'
};

const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ===========================
// Selectores base
// ===========================
const authContainer = $("#auth-container");
const appContainer  = $("#app-container");
const loginForm     = $("#login-form");
const authError     = $("#auth-error");
const logoutBtn     = $("#logout-btn");

// Tabs y secciones
const tabCarga     = $("#tab-carga");
const tabEtiquetas = $("#tab-etiquetas");
const tabBusqueda  = $("#tab-busqueda");
const cargaSection     = $("#carga-section");
const etiquetasSection = $("#etiquetas-section");
const busquedaSection  = $("#busqueda-section");

// Modales (overlay y contenidos)
const settingsBtn       = $("#settings-btn");
const modalOverlay      = $("#modal-overlay");
const allModals         = $$("#modal-overlay .modal-content");
const settingsModal     = $("#settings-modal");
const saveSettingsBtn   = $("#save-settings-btn");
const userApodoInput    = $("#user-apodo");
const closeModalButtons = $$(".close-modal-btn");

// Otros modales
const advancedSearchModal = $("#advanced-search-modal");
const advancedSearchBtn   = $("#advanced-search-btn");
const advancedSearchForm  = $("#advanced-search-form");

const scannerModal  = $("#scanner-modal");
const scannerVideo  = $("#scanner-video");
const cameraSelect  = $("#camera-select");
const scannerFB     = $("#scanner-feedback");

// Modal de etiquetas individuales (ya existía)
const labelModal    = $("#label-modal");
const labelIdText   = $("#label-id-text");
const barcodeSvg    = $("#barcode");
const printLabelBtn = $("#print-label-btn");
const pdfLabelBtn   = $("#pdf-label-btn");

// Modal Envío grupal
const envioModal            = $("#envio-modal");
const openEnvioModalBtn     = $("#open-envio-modal-btn");
const envioCodigoInp        = $("#envio-codigo");
const envioNumeroInp        = $("#envio-numero");
const envioLetraInp         = $("#envio-letra");
const envioAnioInp          = $("#envio-anio");
const agregarExpedienteBtn  = $("#agregar-expediente");
const tablaEnviosBody       = $("#tabla-envios tbody");
const envioOficinaSelect    = $("#envio-oficina-select");
const confirmarEnvioBtn     = $("#confirmar-envio-btn");

// Formularios carga
const expedienteForm = $("#expediente-form");

// Búsqueda
const searchForm = $("#search-form");
const searchResultsContainer = $("#search-results");
const clearSearchBtn = $("#clear-search-btn");

// ETIQUETAS (tab)
const lblCodigo   = $("#lbl-codigo");
const lblNumero   = $("#lbl-numero");
const lblLetra    = $("#lbl-letra");
const lblAnio     = $("#lbl-anio");
const lblAddBtn   = $("#lbl-add-btn");
const lblClearBtn = $("#lbl-clear-btn");
const lblGenBtn   = $("#lbl-generate-pdf-btn");
const lblTableTB  = $("#lbl-table tbody");
const labelsState = { list: [] };

// ===========================
// Tema oscuro / claro (SVG)
// ===========================
function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  const root = document.documentElement;
  const saved = localStorage.getItem("theme") || "light";
  root.setAttribute("data-theme", saved);

  const icons = {
    light: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
    dark:  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
  };
  btn.innerHTML = saved === "dark" ? icons.dark : icons.light;

  btn.onclick = null;
  btn.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    btn.innerHTML = next === "dark" ? icons.dark : icons.light;
  });

  btn.style.color = "var(--text-color)";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
}

// ===========================
// Auth
// ===========================
auth.onAuthStateChanged((user) => {
  if (user) {
    state.currentUser = user;
    authContainer.classList.add("hidden");
    appContainer.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    loadUserProfile();
  } else {
    state.currentUser = null;
    authContainer.classList.remove("hidden");
    appContainer.classList.add("hidden");
    logoutBtn.classList.add("hidden");
  }
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await auth.signInWithEmailAndPassword($("#login-email").value, $("#login-password").value);
    authError.textContent = "";
  } catch (err) {
    console.error(err);
    authError.textContent = "Correo o contraseña incorrectos.";
  }
});
logoutBtn?.addEventListener("click", () => auth.signOut());

async function loadUserProfile() {
  const u = state.currentUser;
  if (!u) return;
  const snap = await db.collection("usuarios").doc(u.uid).get();
  if (snap.exists) {
    state.userProfile = snap.data();
    if (userApodoInput) userApodoInput.value = state.userProfile.apodo || "";
  }
}

// ===========================
// Tabs
// ===========================
function switchTab(active) {
  [tabCarga, tabEtiquetas, tabBusqueda].forEach(t => t.classList.remove("active"));
  [cargaSection, etiquetasSection, busquedaSection].forEach(s => s.classList.add("hidden"));

  if (active === "carga") {
    tabCarga.classList.add("active");
    cargaSection.classList.remove("hidden");
  } else if (active === "etiquetas") {
    tabEtiquetas.classList.add("active");
    etiquetasSection.classList.remove("hidden");
  } else {
    tabBusqueda.classList.add("active");
    busquedaSection.classList.remove("hidden");
  }
}
tabCarga?.addEventListener("click", () => switchTab("carga"));
tabEtiquetas?.addEventListener("click", () => switchTab("etiquetas"));
tabBusqueda?.addEventListener("click", () => switchTab("busqueda"));

// ===========================
// Modales: abrir / cerrar
// ===========================
function openModal(modalEl) {
  if (!modalEl) return;
  modalOverlay.classList.remove("hidden");
  modalEl.classList.remove("hidden");
}
function closeAllModals() {
  modalOverlay.classList.add("hidden");
  allModals.forEach(m => m.classList.add("hidden"));
  // Apagar cámara si estaba activa
  try { state.scanner?.reset(); } catch(_) {}
  if (scannerVideo) {
    const st = scannerVideo.srcObject;
    if (st && st.getTracks) st.getTracks().forEach(t => t.stop());
    scannerVideo.srcObject = null;
  }
}

// Configuración
settingsBtn?.addEventListener("click", () => openModal(settingsModal));
modalOverlay?.addEventListener("click", (e) => { if (e.target === modalOverlay) closeAllModals(); });
closeModalButtons.forEach(btn => btn.addEventListener("click", closeAllModals));
saveSettingsBtn?.addEventListener("click", async () => {
  if (!state.currentUser) return alert("Iniciá sesión primero.");
  const apodo = (userApodoInput?.value || "").trim();
  try {
    await db.collection("usuarios").doc(state.currentUser.uid).set({ apodo }, { merge: true });
    state.userProfile.apodo = apodo;
    alert("Apodo guardado correctamente.");
    closeAllModals();
  } catch (err) {
    console.error(err);
    alert("No se pudo guardar el apodo.");
  }
});

// ===========================
// Dropdown Nomenclatura
// ===========================
const dropdown       = $(".custom-dropdown");
const dropdownToggle = $(".dropdown-toggle");
dropdownToggle?.addEventListener("click", () => {
  dropdown.classList.toggle("open");
});

// ===========================
// Carga de expedientes
// ===========================
expedienteForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const autor = state.userProfile.apodo || state.currentUser?.email || "usuario";
  const expedienteData = {
    codigo:  $("#carga-codigo").value.trim(),
    numero:  $("#carga-numero").value.trim(),
    letra:   $("#carga-letra").value.trim().toUpperCase(),
    anio:    $("#carga-anio").value.trim(),
    extracto:$("#carga-extracto").value.trim(),
    oficina: $("#carga-oficina").value,
    movimiento: $("input[name='movimiento']:checked").value,
    autor,
    createdAt: Timestamp.now(),
    nomen: {
      circunscripcion: $("#nomen-circ")?.value || "",
      seccion:         $("#nomen-secc")?.value || "",
      chacra:          $("#nomen-chac")?.value || "",
      l_ch:            $("#nomen-lch")?.value || "",
      quinta:          $("#nomen-quin")?.value || "",
      l_qt:            $("#nomen-lqt")?.value || "",
      fraccion:        $("#nomen-frac")?.value || "",
      l_fr:            $("#nomen-lfr")?.value || "",
      manzana:         $("#nomen-manz")?.value || "",
      l_mz:            $("#nomen-lmz")?.value || "",
      parcela:         $("#nomen-parc")?.value || "",
      l_pc:            $("#nomen-lpc")?.value || "",
    },
    partidas: {
      prov: $("#part-prov")?.value || "",
      mun:  $("#part-mun")?.value  || "",
    }
  };

  if (!expedienteData.codigo || !expedienteData.numero || !expedienteData.letra || !expedienteData.anio) {
    return alert("Completá Código, Número, Letra y Año.");
  }
  if (!expedienteData.oficina) return alert("Seleccioná una oficina.");

  await db.collection("expedientes").add(expedienteData);
  alert("Expediente guardado con éxito.");
  expedienteForm.reset();
  dropdown?.classList.remove("open");
});

// ===========================
// Lector USB (HID) → distribuir campos
// ===========================
const EXP_SCAN_RE = /^(\d+)[-']?(\d+)[-']?([A-Za-z])[-/'"]?(\d{4})$/;
function parseExpText(str) {
  const m = (str || '').trim().match(EXP_SCAN_RE);
  if (!m) return null;
  const [, c, n, l, a] = m;
  return { c, n, l: l.toUpperCase(), a };
}
function applyToFields(prefix, parts) {
  document.getElementById(`${prefix}-codigo`).value = parts.c;
  document.getElementById(`${prefix}-numero`).value = parts.n;
  document.getElementById(`${prefix}-letra`).value  = parts.l;
  document.getElementById(`${prefix}-anio`).value   = parts.a;
}
[
 '#carga-codigo','#carga-numero','#carga-letra','#carga-anio',
 '#search-codigo','#search-numero','#search-letra','#search-anio'
].forEach(sel => {
  const el = document.querySelector(sel);
  if (!el) return;
  const tryDistribute = () => {
    const v = el.value.trim();
    if (v.length < 8) return;
    const parts = parseExpText(v);
    if (!parts) return;
    const prefix = sel.startsWith('#search') ? 'search' : 'carga';
    applyToFields(prefix, parts);
    el.value = '';
  };
  el.addEventListener('input', tryDistribute);
  el.addEventListener('change', tryDistribute);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') tryDistribute();
  });
});

// ===========================
// Etiqueta individual (CARGA) → PDF A4 (texto 10pt + barra 50mm)
// ===========================
$("#generate-label-btn")?.addEventListener("click", () => {
  const c = $("#carga-codigo").value.trim();
  const n = $("#carga-numero").value.trim();
  const l = $("#carga-letra").value.trim().toUpperCase();
  const a = $("#carga-anio").value.trim();
  if (!c || !n || !l || !a) return alert("Completa Código, Número, Letra y Año.");
  const humanId = `${c}-${n}-${l}/${a}`;
  labelIdText.textContent = humanId;
  JsBarcode(barcodeSvg, `${c}-${n}-${l}-${a}`, { format: "CODE128", displayValue: false, width: 1, height: 28 });
  openModal(labelModal);
});

pdfLabelBtn?.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const humanId = labelIdText.textContent;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const w = doc.internal.pageSize.getWidth();
  const tw = doc.getTextWidth(humanId);
  let y = 20;
  doc.text(humanId, (w - tw) / 2, y);
  y += 3; // ~0.5 de interlineado aprox (en mm)
  const svgData = new XMLSerializer().serializeToString(barcodeSvg);
  const img = new Image();
  img.onload = () => {
    const bw = 50; // 50mm = 5cm
    const bh = (bw * img.height) / img.width;
    const bx = (w - bw) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    doc.addImage(dataUrl, "PNG", bx, y, bw, bh);
    doc.save(`etiqueta-${humanId}.pdf`);
  };
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
});

// ===========================
// ETIQUETAS (tab) → lista + PDF 3x8
// ===========================
function renderLabelsTable() {
  lblTableTB.innerHTML = "";
  labelsState.list.forEach((x, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${x.codigo}</td>
      <td>${x.numero}</td>
      <td>${x.letra}</td>
      <td>${x.anio}</td>
      <td><button data-idx="${i}" class="btn btn-sm btn-danger">❌</button></td>`;
    lblTableTB.appendChild(tr);
  });
  lblTableTB.querySelectorAll("button[data-idx]").forEach((b) =>
    b.addEventListener("click", (e) => {
      const i = parseInt(e.currentTarget.dataset.idx);
      labelsState.list.splice(i, 1);
      renderLabelsTable();
    })
  );
}
function addLabelRow({ codigo, numero, letra, anio }) {
  if (!codigo || !numero || !letra || !anio) return;
  const id = `${codigo}-${numero}-${letra}-${anio}`;
  if (labelsState.list.some((x) => `${x.codigo}-${x.numero}-${x.letra}-${x.anio}` === id)) return;
  labelsState.list.push({ codigo, numero, letra, anio });
  renderLabelsTable();
}

lblAddBtn?.addEventListener("click", () => {
  addLabelRow({
    codigo: lblCodigo.value.trim(),
    numero: lblNumero.value.trim(),
    letra: (lblLetra.value.trim() || '').toUpperCase(),
    anio:  lblAnio.value.trim(),
  });
  lblCodigo.value = lblNumero.value = lblLetra.value = lblAnio.value = "";
  lblCodigo.focus();
});
lblClearBtn?.addEventListener("click", () => {
  if (labelsState.list.length && confirm("¿Vaciar la lista?")) {
    labelsState.list = [];
    renderLabelsTable();
  }
});
// Enter = agregar (sin borrar lo previo)
$("#labels-form")?.addEventListener("submit", (e) => e.preventDefault());
[lblCodigo, lblNumero, lblLetra, lblAnio].forEach((el) => {
  el?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lblAddBtn?.click();
      lblCodigo.focus();
    }
  });
});

async function svgToPngDataUrl(code) {
  return new Promise((resolve) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, code, { format: "CODE128", displayValue: false, width: 1, height: 28 });
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), w: img.width, h: img.height });
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(data)));
  });
}

lblGenBtn?.addEventListener("click", async () => {
  if (!labelsState.list.length) return alert("La lista está vacía.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);

  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 10;
  const gutter = 5;
  const cols = 3;
  const colW = (w - 2 * margin - (cols - 1) * gutter) / cols;
  const rowH = 30;
  const rows = Math.floor((h - 2 * margin + gutter) / (rowH + gutter));

  for (let i = 0; i < labelsState.list.length; i++) {
    const { codigo, numero, letra, anio } = labelsState.list[i];
    const human = `${codigo}-${numero}-${letra}/${anio}`;
    const code  = `${codigo}-${numero}-${letra}-${anio}`;
    const idx   = i % (cols * rows);
    const page  = Math.floor(i / (cols * rows));
    if (idx === 0 && page > 0) doc.addPage();

    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = margin + col * (colW + gutter);
    const y = margin + row * (rowH + gutter);

    const tw = doc.getTextWidth(human);
    doc.text(human, x + (colW - tw) / 2, y + 5);

    const { dataUrl, w: iw, h: ih } = await svgToPngDataUrl(code);
    const bw = Math.min(50, colW - 8); // máx 50 mm
    const bh = (bw * ih) / iw;
    doc.addImage(dataUrl, "PNG", x + (colW - bw) / 2, y + 8, bw, bh);
  }
  doc.save(`etiquetas-${labelsState.list.length}.pdf`);
});

// ===========================
// Búsqueda (simple/avanzada)
// ===========================
function formatDate(ts) {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${dd}/${mm}/${yyyy} - ${h}:${m} ${ampm}`;
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
    const movimiento = movimientoRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    let cls = '';
    if (movimiento === 'recibimos') cls = 'recibimos';
    else if (movimiento === 'enviamos') cls = 'enviamos';

    const el = document.createElement('div');
    el.className = `result-item${i===0?' latest':''} ${cls}`;
    el.innerHTML = `
      ${i===0?'<span class="latest-badge">Último movimiento</span>':''}
      <strong>ID: ${idCompleto}</strong>
      <p class="meta"><strong>Fecha:</strong> ${fecha}</p>
      <p><strong>Extracto:</strong> ${data.extracto || ''}</p>
      <p><strong>Oficina:</strong> ${data.oficina || ''}</p>
      <p><strong>Movimiento:</strong> ${data.movimiento || data.ultimoMovimiento?.tipo || ''}</p>
      <p><strong>Autor:</strong> ${data.autor || ''}</p>
    `;
    searchResultsContainer.appendChild(el);
    i++;
  });
}

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
      for (const k in advValues) {
        const v = advValues[k].trim();
        if (v) base = base.where(k, '==', v);
      }
      const extracto = $('#search-extracto')?.value.trim();
      if (extracto) {
        base = base.where('extracto', '>=', extracto).where('extracto', '<=', extracto + '\uf8ff');
      }
      base = base.orderBy('createdAt', 'desc');
      const snap = await base.get();
      renderSearchResults(snap);
      closeAllModals();
      return;
    }

    const codigo = $('#search-codigo')?.value.trim();
    const numero = $('#search-numero')?.value.trim();
    const letra  = ($('#search-letra')?.value || '').trim().toUpperCase();
    const anio   = $('#search-anio')?.value.trim();
    const extracto = $('#search-extracto')?.value.trim();

    if (!numero) {
      searchResultsContainer.innerHTML = `<p class="error-message">El campo <strong>Número</strong> es obligatorio en búsqueda simple.</p>`;
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
      try { snap = await q2.get(); } catch(e) { console.warn('Índice compuesto faltante:', e); }
    }

    renderSearchResults(snap);
  } catch(err) {
    console.error(err);
    searchResultsContainer.innerHTML = `<p class="error-message">Error al buscar. Puede requerir crear un índice compuesto (ver consola).</p>`;
  }
}
searchForm?.addEventListener("submit", (e) => { e.preventDefault(); performSearch(); });
advancedSearchForm?.addEventListener("submit", (e) => { e.preventDefault(); performSearch(true); });
clearSearchBtn?.addEventListener("click", () => { searchForm.reset(); searchResultsContainer.innerHTML = ''; });
advancedSearchBtn?.addEventListener("click", () => openModal(advancedSearchModal));

// ===========================
// Escáner por cámara (ZXing)
// ===========================
let scanLock = false;

async function listVideoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}
function stopMediaTracks(videoEl) {
  const stream = videoEl.srcObject;
  if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
  videoEl.srcObject = null;
}

async function initScanner(mode) {
  state.scannerMode = mode;
  openModal(scannerModal);
  if (scannerFB) scannerFB.textContent = 'Solicitando acceso a la cámara…';
  if (scannerVideo) scannerVideo.setAttribute('playsinline','true');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:{ ideal:'environment' } } });
    scannerVideo.srcObject = stream;
    try { await scannerVideo.play(); } catch(_){}

    if (scannerFB) scannerFB.textContent = 'Inicializando decodificador…';
    const ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
    state.scanner = new ZXing.BrowserMultiFormatReader();

    const videoInputs = await listVideoInputs();
    cameraSelect.innerHTML = '';
    videoInputs.forEach((d,i)=>{
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Cámara ${i+1}`;
      cameraSelect.appendChild(opt);
    });

    let preferred = videoInputs.find(d => /back|rear|environment|trase/i.test(d.label));
    if (!preferred && videoInputs.length) preferred = videoInputs[videoInputs.length-1];

    stopMediaTracks(scannerVideo);
    scanLock = false;
    if (preferred) {
      await startScanWithDevice(preferred.deviceId);
    } else {
      await startScanWithConstraints({ audio:false, video:{ facingMode:{ ideal:'environment' } } });
    }
    if (scannerFB) scannerFB.textContent = '';
  } catch (err) {
    console.error('getUserMedia error:', err);
    if (scannerFB) scannerFB.textContent = 'Error al iniciar la cámara. Revisá permisos.';
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
cameraSelect?.addEventListener("change", async () => {
  const id = cameraSelect.value;
  if (!id) return;
  if (scannerFB) scannerFB.textContent = 'Cambiando de cámara…';
  scanLock = false;
  try {
    await startScanWithDevice(id);
    if (scannerFB) scannerFB.textContent = '';
  } catch (e) {
    console.error(e);
    if (scannerFB) scannerFB.textContent = 'No se pudo cambiar de cámara.';
  }
});
function handleScanResult(text) {
  // Distribuir en CARGA/BÚSQUEDA si el formato es válido
  const parts = parseExpText(text);
  if (parts) {
    const prefix = state.scannerMode === 'busqueda' ? 'search' : 'carga';
    applyToFields(prefix, parts);
    // Si estamos en búsqueda, lanzamos la consulta
    if (prefix === 'search') performSearch();
  } else {
    alert('Código no reconocido. Formato: CODIGO-NUMERO-LETRA-AÑO');
  }
  stopScanner();
}
function stopScanner() {
  try { state.scanner?.reset(); } catch(_) {}
  stopMediaTracks(scannerVideo);
  closeAllModals();
}
$("#scan-carga-btn")?.addEventListener("click", () => initScanner('carga'));
$("#scan-busqueda-btn")?.addEventListener("click", () => initScanner('busqueda'));

// ===========================
// Envío grupal (modal)
// ===========================
const envioList = [];

function renderEnvioTable() {
  tablaEnviosBody.innerHTML = "";
  envioList.forEach((x, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${x.codigo}</td>
      <td>${x.numero}</td>
      <td>${x.letra}</td>
      <td>${x.anio}</td>
      <td><button data-idx="${i}" class="btn btn-sm btn-danger">❌</button></td>`;
    tablaEnviosBody.appendChild(tr);
  });
  tablaEnviosBody.querySelectorAll("button[data-idx]").forEach((b) =>
    b.addEventListener("click", (e) => {
      const i = parseInt(e.currentTarget.dataset.idx);
      envioList.splice(i, 1);
      renderEnvioTable();
    })
  );
}
function addEnvioRow({ codigo, numero, letra, anio }) {
  if (!codigo || !numero || !letra || !anio) return;
  const id = `${codigo}-${numero}-${letra}-${anio}`;
  if (envioList.some((x)=> `${x.codigo}-${x.numero}-${x.letra}-${x.anio}` === id)) return;
  envioList.push({ codigo, numero, letra, anio });
  renderEnvioTable();
  // limpiar inputs para escanear rápido múltiples
  envioCodigoInp.value = envioNumeroInp.value = envioLetraInp.value = envioAnioInp.value = '';
  envioCodigoInp.focus();
}
openEnvioModalBtn?.addEventListener("click", () => openModal(envioModal));
agregarExpedienteBtn?.addEventListener("click", () => {
  addEnvioRow({
    codigo: envioCodigoInp.value.trim(),
    numero: envioNumeroInp.value.trim(),
    letra: (envioLetraInp.value.trim()||'').toUpperCase(),
    anio: envioAnioInp.value.trim(),
  });
});
[envioCodigoInp, envioNumeroInp, envioLetraInp, envioAnioInp].forEach((el)=>{
  el?.addEventListener("keydown",(e)=>{
    if (e.key === "Enter") {
      e.preventDefault();
      agregarExpedienteBtn.click();
    }
  });
});
confirmarEnvioBtn?.addEventListener("click", async () => {
  if (!envioList.length) return alert("No hay expedientes para enviar.");
  const dest = envioOficinaSelect.value;
  if (!dest) return alert("Seleccioná oficina destino.");
  const autor = state.userProfile.apodo || state.currentUser?.email || "usuario";
  const batch = [];
  for (const x of envioList) {
    batch.push(db.collection('expedientes').add({
      codigo: x.codigo,
      numero: x.numero,
      letra:  x.letra,
      anio:   x.anio,
      extracto: '', // en envío grupal no se usa
      oficina: dest,
      movimiento: 'Enviamos',
      autor,
      createdAt: Timestamp.now(),
    }));
  }
  await Promise.all(batch);
  alert(`Se enviaron ${envioList.length} expedientes a ${dest}.`);
  envioList.splice(0, envioList.length);
  renderEnvioTable();
  closeAllModals();
});

// ===========================
// Inicio
// ===========================
initThemeToggle();
switchTab("carga");
