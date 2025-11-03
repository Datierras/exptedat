// app.js — Gestión de Expedientes (SVG theme + etiquetas + escáner + PDF múltiple)

// --- Firebase config ---
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

// --- Estado global ---
const state = { currentUser: null, userProfile: { apodo: "" }, scanner: null, scannerMode: null };
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// --- Elementos base ---
const authContainer = $("#auth-container");
const appContainer = $("#app-container");
const loginForm = $("#login-form");
const authError = $("#auth-error");
const logoutBtn = $("#logout-btn");

const tabCarga = $("#tab-carga");
const tabEtiquetas = $("#tab-etiquetas");
const tabBusqueda = $("#tab-busqueda");
const cargaSection = $("#carga-section");
const etiquetasSection = $("#etiquetas-section");
const busquedaSection = $("#busqueda-section");

// ========== THEME (SVG, sin emojis) ==========
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

  // Integración visual con tu CSS
  btn.style.color = "var(--text-color)";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
}

// ========== AUTH ==========
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
    authError.textContent = "Error de inicio de sesión";
  }
});
logoutBtn?.addEventListener("click", () => auth.signOut());

async function loadUserProfile() {
  const u = state.currentUser;
  if (!u) return;
  const snap = await db.collection("usuarios").doc(u.uid).get();
  if (snap.exists) state.userProfile = snap.data();
}

// ========== NAVEGACIÓN ENTRE TABS ==========
function switchTab(active) {
  [tabCarga, tabEtiquetas, tabBusqueda].forEach((t) => t.classList.remove("active"));
  [cargaSection, etiquetasSection, busquedaSection].forEach((s) => s.classList.add("hidden"));
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

// ========== CARGA DE EXPEDIENTES ==========
const expedienteForm = $("#expediente-form");
expedienteForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const autor = state.userProfile.apodo || state.currentUser.email;
  const expedienteData = {
    codigo: $("#carga-codigo").value,
    numero: $("#carga-numero").value,
    letra: $("#carga-letra").value.toUpperCase(),
    anio: $("#carga-anio").value,
    extracto: $("#carga-extracto").value,
    oficina: $("#carga-oficina").value,
    movimiento: $("input[name='movimiento']:checked").value,
    autor,
    createdAt: Timestamp.now(),
  };
  if (!expedienteData.oficina) return alert("Selecciona una oficina");
  await db.collection("expedientes").add(expedienteData);
  alert("Expediente guardado");
  expedienteForm.reset();
});

// ========== LECTURA USB (HID) → distribuir campos ==========
const EXP_SCAN_RE = /^(\d+)[-']?(\d+)[-']?([A-Za-z])[-/'"]?(\d{4})$/;
function distributeExpedienteParts(str) {
  const m = (str || '').trim().match(EXP_SCAN_RE);
  if (!m) return null;
  const [, c, n, l, a] = m;
  return { c, n, l: l.toUpperCase(), a };
}

// Auto-distribución en campos de CARGA y BÚSQUEDA
['#carga-codigo', '#carga-numero', '#carga-letra', '#carga-anio',
 '#search-codigo', '#search-numero', '#search-letra', '#search-anio'
].forEach(sel => {
  const el = document.querySelector(sel);
  if (!el) return;

  const tryDistribute = () => {
    const v = el.value.trim();
    if (v.length < 8) return;
    const parts = distributeExpedienteParts(v);
    if (!parts) return;
    // Detectar si estamos en carga o búsqueda por el prefijo del id del campo:
    const prefix = sel.startsWith('#search') ? 'search' : 'carga';
    document.getElementById(`${prefix}-codigo`).value = parts.c;
    document.getElementById(`${prefix}-numero`).value = parts.n;
    document.getElementById(`${prefix}-letra`).value  = parts.l;
    document.getElementById(`${prefix}-anio`).value   = parts.a;
    el.value = ''; // limpiar el campo “fuente” de la lectura pegada
  };

  el.addEventListener('input', tryDistribute);
  el.addEventListener('change', tryDistribute);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      tryDistribute();
    }
  });
});

// ========== ETIQUETA INDIVIDUAL ==========
const generateLabelBtn = $("#generate-label-btn");
const labelIdText = $("#label-id-text");
const barcodeSvg = $("#barcode");
const pdfLabelBtn = $("#pdf-label-btn");

generateLabelBtn?.addEventListener("click", () => {
  const c = $("#carga-codigo").value.trim();
  const n = $("#carga-numero").value.trim();
  const l = $("#carga-letra").value.trim().toUpperCase();
  const a = $("#carga-anio").value.trim();
  if (!c || !n || !l || !a) return alert("Completa todos los campos");
  const humanId = `${c}-${n}-${l}/${a}`;
  labelIdText.textContent = humanId;
  // ancho ~5cm ⇒ ~50mm en PDF. En pantalla dejamos width 1 + height 28 para buena definición.
  JsBarcode(barcodeSvg, `${c}-${n}-${l}-${a}`, { format: "CODE128", displayValue: false, width: 1, height: 28 });
});

pdfLabelBtn?.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const humanId = labelIdText.textContent;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const w = doc.internal.pageSize.getWidth();
  const textW = doc.getTextWidth(humanId);
  let y = 20;
  doc.text(humanId, (w - textW) / 2, y);
  y += 3;
  const svgData = new XMLSerializer().serializeToString(barcodeSvg);
  const img = new Image();
  img.onload = () => {
    const bw = 50; // ~5cm
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

// ========== ETIQUETAS (LOTE 3x8) ==========
const lblCodigo = $("#lbl-codigo");
const lblNumero = $("#lbl-numero");
const lblLetra = $("#lbl-letra");
const lblAnio = $("#lbl-anio");
const lblAddBtn = $("#lbl-add-btn");
const lblClearBtn = $("#lbl-clear-btn");
const lblGenBtn = $("#lbl-generate-pdf-btn");
const lblTableTB = $("#lbl-table tbody");
const labelsState = { list: [] };

function renderLabelsTable() {
  lblTableTB.innerHTML = "";
  labelsState.list.forEach((x, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${x.codigo}</td><td>${x.numero}</td><td>${x.letra}</td><td>${x.anio}</td>
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
    anio: lblAnio.value.trim(),
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

// Enter = agregar (sin enviar/borrar lista)
const labelsForm = document.getElementById("labels-form");
labelsForm?.addEventListener("submit", (e) => e.preventDefault());
[lblCodigo, lblNumero, lblLetra, lblAnio].forEach((el) => {
  el?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lblAddBtn?.click();
      lblCodigo.focus();
    }
  });
});

// Generar PDF múltiple (3 columnas × 8 filas por hoja)
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
  if (!labelsState.list.length) return alert("La lista está vacía");
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
  const rowH = 30;               // alto de celda etiqueta
  const rows = Math.floor((h - 2 * margin + gutter) / (rowH + gutter));

  for (let i = 0; i < labelsState.list.length; i++) {
    const { codigo, numero, letra, anio } = labelsState.list[i];
    const human = `${codigo}-${numero}-${letra}/${anio}`;
    const code = `${codigo}-${numero}-${letra}-${anio}`;
    const idx = i % (cols * rows);
    const page = Math.floor(i / (cols * rows));
    if (idx === 0 && page > 0) doc.addPage();

    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = margin + col * (colW + gutter);
    const y = margin + row * (rowH + gutter);

    const tw = doc.getTextWidth(human);
    doc.text(human, x + (colW - tw) / 2, y + 5);

    const { dataUrl, w: iw, h: ih } = await svgToPngDataUrl(code);
    const bw = Math.min(50, colW - 8);  // máx 50mm ≈ 5cm
    const bh = (bw * ih) / iw;
    doc.addImage(dataUrl, "PNG", x + (colW - bw) / 2, y + 8, bw, bh);
  }
  doc.save(`etiquetas-${labelsState.list.length}.pdf`);
});

// ========== (Opcional) Escáner con cámara (modal existente) ==========
// Si en tu flujo usás ZXing + getUserMedia, acá quedaría el initScanner()
// OMITIDO por brevedad porque no cambia con el tema/íconos.

// ========== ARRANQUE ==========
initThemeToggle();
switchTab("carga");
