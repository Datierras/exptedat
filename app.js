/* ===========================
   APP.JS — Auth + UI + Etiquetas y Códigos de Barra
   =========================== */

(function () {
  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  function show(el) { el && el.classList.remove('hidden'); }
  function hide(el) { el && el.classList.add('hidden'); }

  function assertEl(id) {
    const el = $(id);
    if (!el) throw new Error(`Falta el elemento #${id} en el HTML.`);
    return el;
  }

  function isLibLoaded(name, ref) {
    if (!ref) {
      console.warn(`[Aviso] Librería ${name} no está cargada.`);
      return false;
    }
    return true;
  }

  // ===========================
  //        AUTH (Firebase)
  // ===========================
  let auth = null;
  let db = null;

  function initFirebaseRefs() {
    // config.js debe haber llamado firebase.initializeApp(...)
    if (!firebase?.apps?.length) {
      console.error('Firebase no inicializado. Revisá config.js');
      return;
    }
    auth = firebase.auth();
    db = firebase.firestore();
  }

  function attachAuthHandlers() {
    const authContainer = $('auth-container');
    const appContainer  = $('app-container');
    const loginForm     = $('login-form');
    const authError     = $('auth-error');
    const logoutBtn     = $('logout-btn');

    // Submit login
    on(loginForm, 'submit', async (e) => {
      e.preventDefault();
      authError.textContent = '';
      const email = $('login-email').value.trim();
      const pass  = $('login-password').value;
      try {
        await auth.signInWithEmailAndPassword(email, pass);
      } catch (err) {
        authError.textContent = err?.message || 'Error al iniciar sesión';
      }
    });

    // Logout
    on(logoutBtn, 'click', async () => {
      try { await auth.signOut(); } catch (e) { console.error(e); }
    });

    // Estado de sesión
    auth.onAuthStateChanged((user) => {
      if (user) {
        hide(authContainer);
        show(appContainer);
        show(logoutBtn);
      } else {
        show(authContainer);
        hide(appContainer);
        hide(logoutBtn);
      }
    });
  }

  // ===========================
  //        THEME
  // ===========================
  function attachThemeToggle() {
    const btn = $('theme-toggle');
    on(btn, 'click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }

  // ===========================
  //        MODALES
  // ===========================
  function openModal(modalId) {
    const overlay = $('modal-overlay');
    const modal = $(modalId);
    if (!overlay || !modal) return;
    show(overlay);
    show(modal);
  }
  function closeAllModals() {
    const overlay = $('modal-overlay');
    if (!overlay) return;
    hide(overlay);
    // Cierra cualquier modal abierto
    ['settings-modal','advanced-search-modal','scanner-modal','label-modal']
      .forEach(id => { const el = $(id); el && hide(el); });
  }

  function attachModalHandlers() {
    const overlay = $('modal-overlay');
    // Cerrar por click fuera
    on(overlay, 'click', (e) => { if (e.target === overlay) closeAllModals(); });
    // Cerrar por botones con clase
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      on(btn, 'click', closeAllModals);
    });
    // Cerrar por ESC
    on(document, 'keydown', (e) => { if (e.key === 'Escape') closeAllModals(); });

    // Ajuste: botón específico que agregaste con id
    const closeLabelBtn = $('close-modal-btn');
    on(closeLabelBtn, 'click', closeAllModals);

    // Botones que abren modales (si los usás desde otros lados)
    on($('settings-btn'), 'click', () => openModal('settings-modal'));
    on($('advanced-search-btn'), 'click', () => openModal('advanced-search-modal'));
    on($('scan-carga-btn'), 'click', () => openModal('scanner-modal'));
    on($('scan-busqueda-btn'), 'click', () => openModal('scanner-modal'));
  }

  // ===========================
  //    BARRAS (Generación/PDF)
  // ===========================
  // Acepta variantes: 1234-123456-I-2025 | 1234'123456'I'2025 | 1234-123456-I/2025
  const EXP_RE = /^(\d+)[-']?(\d+)[-']?([A-Za-z])[-'\/]?(\d{4})$/;

  function buildExpedienteId() {
    const c = assertEl('carga-codigo').value.trim();
    const n = assertEl('carga-numero').value.trim();
    const l = (assertEl('carga-letra').value || '').trim().toUpperCase();
    const a = assertEl('carga-anio').value.trim();

    if (!c || !n || !l || !a) {
      throw new Error('Completá: Código, Número, Letra y Año.');
    }

    const humanReadable = `${c}-${n}-${l}/${a}`; // lo que se ve arriba
    const barcodeValue  = `${c}-${n}-${l}-${a}`; // lo que se codifica

    return { humanReadable, barcodeValue, raw: { c, n, l, a } };
  }

  function renderBarcode(selectorOrCanvas, value, opts = {}) {
    if (!isLibLoaded('JsBarcode', window.JsBarcode)) return;
    const defaults = { format: 'CODE128', displayValue: true, fontSize: 16, margin: 12 };
    const options  = Object.assign({}, defaults, opts);
    try {
      window.JsBarcode(selectorOrCanvas, value, options);
    } catch (e) {
      console.error('Error generando código de barras:', e);
      alert('No se pudo generar el código de barras. Revisá que JsBarcode esté cargado.');
    }
  }

  function openLabelModal(data) {
    const overlay = assertEl('modal-overlay');
    const modal   = assertEl('label-modal');
    const txt     = assertEl('label-id-text');
    const svg     = assertEl('barcode');

    txt.textContent = `Expediente: ${data.humanReadable}`;
    renderBarcode('#barcode', data.barcodeValue);

    show(overlay);
    show(modal);
  }

  function generatePdf({ humanReadable, barcodeValue }) {
    const jspdf = window.jspdf;
    if (!isLibLoaded('jsPDF', jspdf?.jsPDF)) {
      alert('No se encontró jsPDF. Cargá la librería antes de usar "PDF".');
      return;
    }
    // Canvas temporal para buena calidad
    const canvas = document.createElement('canvas');
    canvas.width  = 1400; // ancho alto para buena definición
    canvas.height = 360;
    renderBarcode(canvas, barcodeValue, { fontSize: 48, margin: 16 });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(`Expediente: ${humanReadable}`, 50, 80);

    const imgW = 520;
    const imgH = (canvas.height / canvas.width) * imgW;
    pdf.addImage(imgData, 'PNG', 50, 110, imgW, imgH);

    pdf.save(`etiqueta_${barcodeValue}.pdf`);
  }

  function tryDistributeExpediente(str) {
    const m = str.trim().match(EXP_RE);
    if (!m) return false;
    const [, c, n, l, a] = m;
    const elC = $('carga-codigo');
    const elN = $('carga-numero');
    const elL = $('carga-letra');
    const elA = $('carga-anio');
    if (elC) elC.value = c;
    if (elN) elN.value = n;
    if (elL) elL.value = l.toUpperCase();
    if (elA) elA.value = a;
    return true;
    // TIP: si tu escáner termina con TAB, el foco saltará. Si termina con ENTER (CR),
    // podés enganchar 'keydown' para distribuir al presionarlo si detectás patrón.
  }

  function hookPasteAndChange() {
    const ids = ['carga-codigo','carga-numero','carga-letra','carga-anio'];
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;

      // Pegar una lectura completa en cualquier campo
      on(el, 'paste', (ev) => {
        const text = (ev.clipboardData || window.clipboardData).getData('text');
        if (tryDistributeExpediente(text)) {
          ev.preventDefault();
        }
      });

      // Distribuir al cambiar de foco, por si el escáner escribe todo en uno
      on(el, 'change', () => { tryDistributeExpediente(el.value); });

      // Distribución “en vivo” si detecta el patrón
      on(el, 'input', () => {
        const v = el.value;
        if (v.length >= 6 && EXP_RE.test(v)) {
          if (tryDistributeExpediente(v)) { el.value = ''; }
        }
      });
    });
  }

  function hookLabelButtons() {
    const genBtn  = $('generate-label-btn');
    const printBtn= $('print-label-btn');
    const pdfBtn  = $('pdf-label-btn');

    on(genBtn, 'click', () => {
      try {
        const data = buildExpedienteId();
        openLabelModal(data);
      } catch (e) {
        alert(e.message);
      }
    });

    // Imprimir (requiere tener el modal abierto)
    on(printBtn, 'click', () => window.print());

    // PDF
    on(pdfBtn, 'click', () => {
      try {
        const data = buildExpedienteId();
        generatePdf(data);
      } catch (e) {
        alert(e.message);
      }
    });
  }

  // ===========================
  //    BÚSQUEDA (mínimo)
  // ===========================
  function attachSearchHandlers() {
    const form = $('search-form');
    const results = $('search-results');
    on(form, 'submit', (e) => {
      e.preventDefault();
      // Acá iría tu lógica real de búsqueda (Firestore, etc).
      // Dejo un placeholder para no romper nada.
      if (results) {
        results.innerHTML = '<div class="result-item">[Resultado de ejemplo] Completar lógica de búsqueda…</div>';
      }
    });
    on($('clear-search-btn'), 'click', () => {
      ['search-codigo','search-numero','search-letra','search-anio','search-extracto'].forEach(id => {
        const el = $(id); if (el) el.value = '';
      });
      if (results) results.innerHTML = '';
    });
  }

  // ===========================
  //        INIT
  // ===========================
  document.addEventListener('DOMContentLoaded', () => {
    try {
      initFirebaseRefs();
      if (auth) attachAuthHandlers();
      attachThemeToggle();
      attachModalHandlers();
      hookLabelButtons();
      hookPasteAndChange();
      attachSearchHandlers();

      console.log('App inicializada: handlers y distribución de lecturas activos.');
    } catch (e) {
      console.error('Error de inicialización:', e);
    }
  });
})();
