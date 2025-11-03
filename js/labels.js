// /js/labels.js
// Gestión del tab "ETIQUETAS": carga de lista y PDF mosaico 3×N en A4

// Utilidad DOM
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Estado simple en memoria
const LabelsState = {
  items: [] // { codigo, numero, letra, anio }
};

// ----- Selectores -----
let inpCod, inpNum, inpLet, inpAnio;
let btnAdd, btnClear, btnPdf;
let tableBody;

// Patrón  CODIGO-NUMERO-LETRA-AÑO  con separadores - o '
const EXP_RE = /^(\d+)[-'](\d+)[-']([A-Za-z])[-'](\d{4})$/;

// ===== Helpers =====
function normalizePart(v) { return (v || '').toString().trim(); }

function readCurrentInputs() {
  return {
    codigo: normalizePart(inpCod.value),
    numero: normalizePart(inpNum.value),
    letra : normalizePart(inpLet.value).toUpperCase(),
    anio  : normalizePart(inpAnio.value)
  };
}

function clearInputs() {
  inpCod.value = '';
  inpNum.value = '';
  inpLet.value = '';
  inpAnio.value = '';
  inpCod.focus();
}

function isValidItem(it) {
  return it.codigo && it.numero && /^[A-Za-z]$/.test(it.letra) && /^\d{4}$/.test(it.anio);
}

function pushItem(it) {
  // evitar duplicados exactos
  const key = `${it.codigo}-${it.numero}-${it.letra}-${it.anio}`;
  const exists = LabelsState.items.some(x => `${x.codigo}-${x.numero}-${x.letra}-${x.anio}` === key);
  if (exists) return false;
  LabelsState.items.push(it);
  renderTable();
  return true;
}

function removeAt(idx) {
  LabelsState.items.splice(idx, 1);
  renderTable();
}

function renderTable() {
  tableBody.innerHTML = '';
  LabelsState.items.forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.codigo}</td>
      <td>${it.numero}</td>
      <td>${it.letra}</td>
      <td>${it.anio}</td>
      <td><button type="button" data-rm="${idx}">Quitar</button></td>
    `;
    tableBody.appendChild(tr);
  });
  // Bind quitar
  tableBody.querySelectorAll('button[data-rm]').forEach(btn => {
    btn.addEventListener('click', () => removeAt(parseInt(btn.dataset.rm,10)));
  });
}

// ====== Barcode → PNG (para insertar en jsPDF) ======
async function barcodePNG(text, pxWidth) {
  // Generar en <canvas> directo (más simple que SVG→Canvas)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Alto en px proporcional para buena lectura en impresión
  const targetWidthPx = Math.max(300, Math.min(pxWidth, 900)); // suavizar rangos
  const targetHeightPx = Math.round(targetWidthPx * 0.25);     // relación aprox 4:1

  canvas.width = targetWidthPx;
  canvas.height = targetHeightPx;

  // Fondo blanco
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Usar JsBarcode sobre canvas
  JsBarcode(canvas, text, {
    format: 'CODE128',
    lineColor: '#000000',
    background: '#ffffff',
    width: 2,                 // grosor de barra
    height: targetHeightPx-8, // deja margen arriba/abajo
    displayValue: false
  });

  // recortar bordes si hiciera falta (ya viene bien)
  return canvas.toDataURL('image/png');
}

// ====== Generar PDF mosaico 3×N ======
async function generateMosaicPDF() {
  if (!LabelsState.items.length) {
    alert('No hay etiquetas para generar.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  // Medidas A4
  const PAGE_W = 210, PAGE_H = 297;

  // Márgenes y grilla
  const MARGIN = 10;          // margen externo
  const GAP = 4;              // separación entre tarjetas
  const COLS = 3;             // 3 por fila
  const usableW = PAGE_W - MARGIN*2;
  const cardW = (usableW - GAP*(COLS-1)) / COLS;

  // Alto de tarjeta (texto + código). Tomamos ~35mm
  const cardH = 35;

  // Tipografía del encabezado
  const TEXT_SIZE = 10; // pedido
  const LINE_GAP = 2;   // pequeño espacio antes del código (≈0.5 de interlineado visual)

  // Ancho máximo del código de barras: 50mm (pedido)
  const BARCODE_W_MM = Math.min(50, cardW - 8); // respeta margen interno si la tarjeta es más angosta
  const BARCODE_H_MM = 12;                      // altura legible sin ocupar todo

  // Conversión mm → px para el canvas del barcode (aprox 96 DPI)
  const PX_PER_MM = 96 / 25.4;
  const barcodePxW = Math.round(BARCODE_W_MM * PX_PER_MM);

  let col = 0, rowY = MARGIN;

  for (let i = 0; i < LabelsState.items.length; i++) {
    const it = LabelsState.items[i];
    const fullId = `${it.codigo}-${it.numero}-${it.letra}-${it.anio}`;

    const x = MARGIN + col * (cardW + GAP);
    const y = rowY;

    // Tarjeta (sin bordes visibles; mantenemos limpio para impresión)
    // Encabezado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TEXT_SIZE);
    doc.text(fullId, x + cardW/2, y + 6, { align: 'center', baseline: 'middle' });

    // Barcode PNG
    // Generamos PNG centrado y con ancho máx 50mm
    // Nota: jsPDF coloca imagen por tamaño en mm
    // Distancia entre texto y código (≈0.5 interlineado visual)
    const barcodeY = y + 6 + LINE_GAP + 2;

    const dataUrl = await barcodePNG(fullId, barcodePxW);
    const barcodeX = x + (cardW - BARCODE_W_MM)/2;
    doc.addImage(dataUrl, 'PNG', barcodeX, barcodeY, BARCODE_W_MM, BARCODE_H_MM);

    // Avanzar columna/fila
    col++;
    if (col >= COLS) {
      col = 0;
      rowY += cardH + GAP;
      // Si no entra otra fila, nueva página
      if (rowY + cardH > PAGE_H - MARGIN) {
        if (i < LabelsState.items.length - 1) {
          doc.addPage();
          rowY = MARGIN;
        }
      }
    }
  }

  doc.save('etiquetas.pdf');
}

// ====== Inicialización pública ======
export function initLabelsTab() {
  // Inputs
  inpCod  = $('#labels-codigo');
  inpNum  = $('#labels-numero');
  inpLet  = $('#labels-letra');
  inpAnio = $('#labels-anio');

  // Botones
  btnAdd   = $('#labels-add-btn');
  btnClear = $('#labels-clear-btn');
  btnPdf   = $('#labels-generate-pdf');

  tableBody = $('#labels-table tbody');

  // Agregar con botón
  btnAdd.addEventListener('click', () => {
    const it = readCurrentInputs();
    if (!isValidItem(it)) {
      alert('Completá Código, Número, una letra y un año válido (4 dígitos).');
      return;
    }
    const ok = pushItem(it);
    clearInputs();
    if (!ok) alert('Ese expediente ya está en la lista.');
  });

  // Agregar con ENTER desde cualquiera de los 4 inputs
  [inpCod, inpNum, inpLet, inpAnio].forEach(el => {
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        btnAdd.click();
      }
    });
  });

  // Vaciar lista
  btnClear.addEventListener('click', () => {
    if (!LabelsState.items.length) return;
    if (confirm('¿Vaciar la lista de etiquetas?')) {
      LabelsState.items = [];
      renderTable();
      clearInputs();
    }
  });

  // Generar PDF
  btnPdf.addEventListener('click', generateMosaicPDF);
}
