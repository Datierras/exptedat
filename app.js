/* ===========================
   APP.JS — Gestión de Etiquetas y Códigos de Barras
   =========================== */

(function () {
  // ---------- Utilidades ----------
  const $ = (id) => document.getElementById(id);

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

  // ---------- Construcción del ID de Expediente ----------
  function buildExpedienteId() {
    const c = assertEl('carga-codigo').value.trim();
    const n = assertEl('carga-numero').value.trim();
    const l = (assertEl('carga-letra').value || '').trim().toUpperCase();
    const a = assertEl('carga-anio').value.trim();

    if (!c || !n || !l || !a) {
      throw new Error('Completá: Código, Número, Letra y Año.');
    }

    // Para lectura humana (coincide con tus etiquetas anteriores)
    const humanReadable = `${c}-${n}-${l}/${a}`;
    // Para el código de barras (guiones consistentes; evita “/”)
    const barcodeValue = `${c}-${n}-${l}-${a}`;

    return { humanReadable, barcodeValue, raw: { c, n, l, a } };
  }

  // ---------- Generación de Código de Barras ----------
  function renderBarcode(selector, value, opts = {}) {
    if (!isLibLoaded('JsBarcode', window.JsBarcode)) return;

    const defaults = {
      format: 'CODE128',
      displayValue: true,
      fontSize: 16,
      margin: 12
    };
    const options = Object.assign({}, defaults, opts);

    try {
      window.JsBarcode(selector, value, options);
    } catch (e) {
      console.error('Error generando código de barras:', e);
      alert('No se pudo generar el código de barras. Revisá que JsBarcode esté cargado.');
    }
  }

  // ---------- PDF con jsPDF ----------
  function generatePdf({ humanReadable, barcodeValue }) {
    const jspdf = window.jspdf;
    if (!isLibLoaded('jsPDF', jspdf?.jsPDF)) {
      alert('No se encontró jsPDF. Cargá la librería antes de usar "PDF".');
      return;
    }

    // Renderizamos a un canvas temporal para calidad óptima del código
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
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

  // ---------- Modal ----------
  function openLabelModal({ humanReadable, barcodeValue }) {
    const overlay = assertEl('modal-overlay');
    const modal = assertEl('label-modal');
    const txt = assertEl('label-id-text');

    txt.textContent = `Expediente: ${humanReadable}`;
    renderBarcode('#barcode', barcodeValue);

    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
  }

  function closeLabelModal() {
    const overlay = $('modal-overlay');
    const modal = $('label-modal');
    if (overlay) overlay.classList.add('hidden');
    if (modal) modal.classList.add('hidden');
  }

  // ---------- Distribución automática de lecturas ----------
  // Acepta variantes: 1234-123456-I-2025 | 1234'123456'I'2025 | 1234-123456-I/2025
  const EXP_RE = /^(\d+)[-']?(\d+)[-']?([A-Za-z])[-'\/]?(\d{4})$/;

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
  }

  function hookPasteAndChange() {
    const ids = ['carga-codigo', 'carga-numero', 'carga-letra', 'carga-anio'];
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;

      // Pegar una lectura completa en cualquier campo
      el.addEventListener('paste', (ev) => {
        const text = (ev.clipboardData || window.clipboardData).getData('text');
        if (tryDistributeExpediente(text)) {
          ev.preventDefault();
        }
      });

      // Si el escáner escribe todo en un campo y termina con Enter/Tab,
      // al cambiar de foco intentamos distribuir.
      el.addEventListener('change', () => {
        tryDistributeExpediente(el.value);
      });

      // Intento en vivo: si detecta patrón, distribuye y evita que “ensucie” el campo
      el.addEventListener('input', () => {
        const v = el.value;
        if (v.length >= 6 && EXP_RE.test(v)) {
          if (tryDistributeExpediente(v)) {
            // Borro el campo actual para no duplicar
            el.value = '';
          }
        }
      });
    });
  }

  // ---------- Botones ----------
  function hookButtons() {
    const genBtn = $('generate-label-btn');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        try {
          const data = buildExpedienteId();
          openLabelModal(data);
        } catch (e) {
          alert(e.message);
        }
      });
    }

    const printBtn = $('print-label-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }

    const pdfBtn = $('pdf-label-btn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => {
        try {
          const data = buildExpedienteId();
          generatePdf(data);
        } catch (e) {
          alert(e.message);
        }
      });
    }

    const closeBtn = $('close-modal-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeLabelModal);
    }

    // Cerrar modal clickeando fuera
    const overlay = $('modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeLabelModal();
      });
    }

    // Escape para cerrar modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLabelModal();
    });
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    try {
      hookButtons();
      hookPasteAndChange();
      console.log('App inicializada: handlers y distribución de lecturas activos.');
    } catch (e) {
      console.error('Error de inicialización:', e);
    }
  });
})();
