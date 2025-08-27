// Core App (v3): primary Guardar Movimiento, soft Generar Código, Destino/Origen, ubicacionActual, glass modals
import { BrowserMultiFormatReader } from 'https://cdn.jsdelivr.net/npm/@zxing/browser@latest/+esm';
import { firebaseConfig } from './config.js';

import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp,
  collection, query, where, getDocs, collectionGroup
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getStorage, ref as storageRef, uploadString, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// --- Init Firebase ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- Constants ---
const AREA_PROPIA = "Coordinación General de Programa de Tierras y Regularización Dominial"; // para ubicacionActual al recibir
const AREAS = [
  "Administración General",
  "D.G. de Ingreso de Tierras",
  "D.G. de Escrituración Familiar",
  "D.G. de Regularización Dominial",
  "D.G. de Programa de Tierras",
  "C.G.P. Legal, Administrativo e Institucional",
  "C.G.P. de Hábitat, Vivienda e Integración Urbana",
  "C.G.P. Abordate Territorial",
  "C.G.P. de Obras Particulares y Catastro",
  "C.G.P. de Gerencia de Proyectos",
  "Contaduría",
  "Jefatura de Compras y Contrataciones",
  "Tesorería",
  "Mesa de Entradas"
];
const legendTextConst = AREA_PROPIA;

// --- Helpers DOM ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const showEl = (el) => el.classList.remove('hidden');
const hideEl = (el) => el.classList.add('hidden');

// --- UI elements ---
const loginScreen = $('#loginScreen');
const appRoot = $('#appRoot');
const btnLogin = $('#btnLogin');
const loginEmail = $('#loginEmail');
const loginPass = $('#loginPass');
const loginMsg = $('#loginMsg');

const tabBtnCarga = $('#tabBtnCarga');
const tabBtnBusqueda = $('#tabBtnBusqueda');
const panelCarga = $('#panelCarga');
const panelBusqueda = $('#panelBusqueda');

const inCodigo = $('#inCodigo');
const inNumero = $('#inNumero');
const inLetra  = $('#inLetra');
const inAnio   = $('#inAnio');
const inExtracto = $('#inExtracto');
const btnGenerar = $('#btnGenerar');
const btnGuardarExpediente = $('#btnGuardarExpediente');
const msgCarga = $('#msgCarga');
const showNomenclaturaBtn = $('#showNomenclaturaBtn');
const nomenclaturaFields = $('#nomenclatura-fields');
const selArea = $('#selArea');
const lblArea = $('#lblArea');

// load AREAS into select
(function fillAreas(){
  for (const a of AREAS) {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    selArea.appendChild(opt);
  }
})();

// Carga - nomenclatura inputs
const nomIds = [
  'circunscripcion','seccion','chacra','letraChacra','quinta','letraQuinta',
  'fraccion','letraFraccion','manzana','letraManzana','parcela','letraParcela',
  'partidaProvincial','partidaMunicipal'
];
const nomInputs = Object.fromEntries(nomIds.map(id => [id, $('#'+id)]));

// Movimiento tipo
function getMovTipo() {
  const v = document.querySelector('input[name="movTipo"]:checked')?.value || 'Enviamos';
  return v;
}
function refreshAreaLabel(){
  const t = getMovTipo();
  lblArea.textContent = (t === 'Enviamos') ? 'Destino' : 'Origen';
  const ph = (t === 'Enviamos') ? 'Seleccioná destino' : 'Seleccioná origen';
  selArea.querySelector('option[value=""]').textContent = ph;
}
$('#movEnviamos').addEventListener('change', refreshAreaLabel);
$('#movRecibimos').addEventListener('change', refreshAreaLabel);
refreshAreaLabel();

// Búsqueda
const bCodigo = $('#bCodigo');
const bNumero = $('#bNumero');
const bLetra  = $('#bLetra');
const bAnio   = $('#bAnio');
const btnBuscar = $('#btnBuscar');
const resultados = $('#resultados');
const usbScanInput = $('#usbScanInput');
const btnBusqAvanzada = $('#btnBusqAvanzada');
const busqAvanzada = $('#busqAvanzada');
const btnBuscarAvanzado = $('#btnBuscarAvanzado');
const btnLimpiarFiltros = $('#btnLimpiarFiltros');

// Avanzada inputs
const aIds = [
  'aCircunscripcion','aSeccion','aChacra','aLetraChacra','aQuinta','aLetraQuinta',
  'aFraccion','aLetraFraccion','aManzana','aLetraManzana','aParcela','aLetraParcela',
  'aPartidaProvincial','aPartidaMunicipal'
];
const aInputs = Object.fromEntries(aIds.map(id => [id, $('#'+id)]));

// Scanning
const btnEscanear = $('#btnEscanear');
const selCamaras = $('#selCamaras');
const btnLinterna = $('#btnLinterna');
const video = $('#video');
const msgEscaner = $('#msgEscaner');

// Barcode modal
const barcodeCanvas = $('#barcodeCanvas');
const barcodeHuman = $('#barcodeHuman');
const legendText = $('#legendText');
const btnCopiarId = $('#btnCopiarId');
const btnDescargarPng = $('#btnDescargarPng');
const btnImprimirPdf = $('#btnImprimirPdf');
const msgModal = $('#msgModal');

// Config
const btnConfig = $('#btnConfig');
const modalConfig = $('#modalConfig');
const btnLogout = $('#btnLogout');
const confApodo = $('#confApodo');
const btnGuardarApodo = $('#btnGuardarApodo');
const msgApodo = $('#msgApodo');

// Toast mini
const toast = (el, msg, ok = true, timeout=3000) => {
  el.textContent = msg;
  el.className = "text-sm mt-2 " + (ok ? "text-green-600" : "text-red-600");
  setTimeout(()=>{ el.textContent = ""; el.className="text-sm"; }, timeout);
};

// Tabs
function setActiveTab(tab) {
  const isCarga = tab === 'carga';
  tabBtnCarga.dataset.active = isCarga;
  tabBtnBusqueda.dataset.active = !isCarga;
  panelCarga.classList.toggle('hidden', !isCarga);
  panelBusqueda.classList.toggle('hidden', isCarga);
  if (!isCarga) focusUsbInput();
}
tabBtnCarga.addEventListener('click', () => setActiveTab('carga'));
tabBtnBusqueda.addEventListener('click', () => setActiveTab('busqueda'));

// Modals (ESC + backdrop)
function bindModalEsc() {
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') {
      ['modalCodigo','modalEscaner','modalConfig'].forEach(id => hideEl(document.getElementById(id)));
      stopScanner();
    }
  });
}
bindModalEsc();
$$('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', (e)=>{
    const id = e.currentTarget.getAttribute('data-close-modal');
    const el = document.getElementById(id);
    hideEl(el);
    if (id === 'modalEscaner') stopScanner();
  });
});
['modalCodigo','modalEscaner','modalConfig'].forEach(id=>{
  const el = document.getElementById(id);
  el.addEventListener('click', (e)=>{
    if (e.target.id === id) {
      hideEl(el);
      if (id === 'modalEscaner') stopScanner();
    }
  });
});

btnConfig.addEventListener('click', ()=> showEl(modalConfig));

// --- Auth gating ---
onAuthStateChanged(auth, async (user)=>{
  if (user) {
    hideEl(loginScreen);
    showEl(appRoot);
    setActiveTab('carga');
    await loadApodo(user.uid);
  } else {
    showEl(loginScreen);
    hideEl(appRoot);
  }
});

btnLogin.addEventListener('click', async ()=>{
  loginMsg.textContent = "";
  try {
    const email = loginEmail.value.trim();
    const pass = loginPass.value;
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    console.error(e);
    loginMsg.textContent = "No se pudo iniciar sesión.";
    loginMsg.className = "text-sm text-red-600 h-5";
  }
});

btnLogout.addEventListener('click', async ()=>{
  await signOut(auth);
});

// --- Apodo ---
async function loadApodo(uid) {
  try {
    const r = await getDoc(doc(db, 'usuarios', uid));
    confApodo.value = r.exists() ? (r.data().apodo || '') : '';
  } catch { confApodo.value = ''; }
}
btnGuardarApodo.addEventListener('click', async ()=>{
  const user = auth.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(db,'usuarios', user.uid), { apodo: confApodo.value.trim() }, { merge: true });
    toast(msgApodo, "Apodo guardado.");
  } catch (e) {
    console.error(e);
    toast(msgApodo, "No se pudo guardar.", false);
  }
});

// --- Validación CARGA ---
function normalizeLetraInput() {
  inLetra.value = (inLetra.value || '').toUpperCase().replace(/[^A-Z]/g,'').slice(0,1);
}
inLetra.addEventListener('input', normalizeLetraInput);

function validCarga() {
  const codigoOk = /^\d{4}$/.test(inCodigo.value);
  const numeroOk = /^\d{6}$/.test(inNumero.value);
  const letraOk  = /^[A-Z]$/.test((inLetra.value||'').toUpperCase());
  const anioOk   = /^\d{4}$/.test(inAnio.value);
  btnGenerar.disabled = !(codigoOk && numeroOk && letraOk && anioOk);
}
[inCodigo, inNumero, inLetra, inAnio].forEach(i=> i.addEventListener('input', ()=>{ normalizeLetraInput(); validCarga(); }));
validCarga();

const makeId = (c,n,l,a) => `${c}-${n}-${(l||'').toUpperCase()}-${a}`;
const parseId = (id) => {
  const m = /^(\d{4})-(\d{6})-([A-Z])-(\d{4})$/.exec((id||'').toUpperCase());
  if (!m) return null;
  return { codigo: m[1], numero: m[2], letra: m[3], anio: m[4] };
};

// Nomenclatura toggle
showNomenclaturaBtn.addEventListener('click', ()=>{
  nomenclaturaFields.classList.toggle('hidden');
});

// Guardar Movimiento
btnGuardarExpediente.addEventListener('click', async ()=>{
  const id = makeId(inCodigo.value, inNumero.value, inLetra.value, inAnio.value);
  const parsed = parseId(id);
  if (!parsed) { toast(msgCarga, "Completá Código/Número/Letra/Año válidos.", false); return; }
  const area = selArea.value;
  if (!area) { toast(msgCarga, "Seleccioná Destino/Origen.", false); return; }
  const extracto = (inExtracto.value || "").trim();
  const nom = {};
  for (const [k, el] of Object.entries(nomInputs)) {
    let val = el.value.trim();
    if (!val) continue;
    if (/^(letra|seccion)/i.test(k)) val = val.toUpperCase();
    if (!isNaN(Number(val)) && !/^letra/i.test(k) && k!=='seccion') val = Number(val);
    nom[k] = val;
  }
  const user = auth.currentUser;
  try {
    // Upsert expediente + ubicacionActual
    const tipo = getMovTipo();
    const ubicacionActual = (tipo === 'Enviamos') ? area : AREA_PROPIA;
    const ref = doc(db, 'expedientes', id);
    await setDoc(ref, {
      codigo: parsed.codigo,
      numero: parsed.numero,
      letra: parsed.letra,
      anio: parsed.anio,
      extracto,
      nomenclatura: nom,
      ubicacionActual,
      updatedAt: serverTimestamp(),
      lastMov: { tipo, area, fecha: serverTimestamp() }
    }, { merge: true });

    // Registrar movimiento (guardo sólo el campo que aplique)
    const movData = {
      expedienteId: id,
      tipo,
      fecha: serverTimestamp(),
      actorApodo: (await getUserApodo()) || (user?.email || user?.uid || 'desconocido'),
      actorUid: user?.uid || null,
      actorEmail: user?.email || null,
      area // guardo como campo genérico y también específico abajo
    };
    if (tipo === 'Enviamos') movData.destino = area;
    else movData.origen = area;

    const movRef = doc(collection(db, 'expedientes', id, 'movimientos'));
    await setDoc(movRef, movData);

    toast(msgCarga, "Movimiento guardado y expediente actualizado.");
  } catch (e) {
    console.error(e);
    toast(msgCarga, "No se pudo guardar el movimiento.", false);
  }
});

async function getUserApodo(){
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const u = await getDoc(doc(db,'usuarios', user.uid));
    return (u.exists() && u.data().apodo) ? u.data().apodo : (user.email || user.uid);
  } catch { return null; }
}

// Generación de barcode (abre modal al instante + persiste en background)
async function generarBarcodeOnCanvas(value, widthPx=600, heightPx=240) {
  const ctx = barcodeCanvas.getContext('2d');
  barcodeCanvas.width = widthPx;
  barcodeCanvas.height = heightPx;
  ctx.clearRect(0,0,widthPx,heightPx);
  JsBarcode(barcodeCanvas, value, {
    format: 'CODE128',
    displayValue: false,
    margin: 10,
    background: '#ffffff',
    lineColor: '#000000',
    width: 2,
    height: heightPx - 20
  });
}
function generarBarcodePNG(value, widthPx=600, heightPx=240) {
  return new Promise((resolve)=>{
    generarBarcodeOnCanvas(value, widthPx, heightPx);
    resolve(barcodeCanvas.toDataURL('image/png'));
  });
}

btnGenerar.addEventListener('click', async ()=>{
  try {
    const expedienteId = makeId(inCodigo.value, inNumero.value, inLetra.value, inAnio.value);
    // Render inmediato y abrir modal
    await generarBarcodeOnCanvas(expedienteId, 600, 240);
    barcodeHuman.textContent = expedienteId;
    legendText.textContent = legendTextConst;
    const localDataUrl = barcodeCanvas.toDataURL('image/png');
    btnDescargarPng.href = localDataUrl; // fallback inmediato
    showEl(document.getElementById('modalCodigo'));
    msgModal.textContent = "";

    // Persistencia en background
    (async ()=>{
      try{
        const ref = doc(db, 'codigos', expedienteId);
        const snap = await getDoc(ref);
        let imageUrl = null;
        if (!snap.exists()) {
          const path = `labels/${expedienteId}.png`;
          const sref = storageRef(storage, path);
          await uploadString(sref, localDataUrl, 'data_url');
          imageUrl = await getDownloadURL(sref);
          await setDoc(ref, {
            expedienteId,
            symbology: 'code128',
            value: expedienteId,
            imageUrl,
            printLabelText: legendTextConst,
            createdAt: serverTimestamp(),
            createdBy: (auth.currentUser?.email || auth.currentUser?.uid || null)
          });
        } else {
          imageUrl = snap.data().imageUrl;
        }
        if (imageUrl) btnDescargarPng.href = imageUrl; // mejora si está
      } catch (e){ print(e) }
    })();

  } catch (e) { print(e) }
});

btnCopiarId.addEventListener('click', async ()=>{
  const text = barcodeHuman.textContent || "";
  try { await navigator.clipboard.writeText(text); toast(msgModal, "ID copiado."); }
  catch { toast(msgModal, "No se pudo copiar.", false); }
});

btnImprimirPdf.addEventListener('click', async ()=>{
  try {
    const expedienteId = barcodeHuman.textContent || "";
    const { jsPDF } = window.jspdf;
    const docPDF = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297;
    const labelW = 50, labelH = 20;
    const x = (pageW - labelW) / 2;
    const y = (pageH - labelH) / 2;
    const png = barcodeCanvas.toDataURL('image/png');
    docPDF.setFontSize(8);
    docPDF.text(legendTextConst, pageW/2, y - 3, { align: 'center' });
    docPDF.addImage(png, 'PNG', x, y, labelW, labelH);
    docPDF.setFontSize(12);
    docPDF.text(expedienteId, pageW/2, y + labelH + 6, { align: 'center' });
    const pdfUrl = docPDF.output('bloburl');
    window.open(pdfUrl, '_blank');
  } catch (e) { print(e) }
});

// --- Búsqueda por ID ---
btnBuscar.addEventListener('click', async ()=>{
  const id = makeId(
    bCodigo.value.padStart(4,'0'),
    bNumero.value.padStart(6,'0'),
    (bLetra.value||'').toUpperCase(),
    bAnio.value
  );
  const parsed = parseId(id);
  if (!parsed) {
    resultados.innerHTML = `<div class="border rounded-xl p-4 text-sm text-red-600 bg-white">Completá los 4 campos correctamente (####-######-L-####).</div>`;
    return;
  }
  await buscarPorId(id);
});

usbScanInput.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter') {
    const val = usbScanInput.value.trim();
    const parsed = parseId(val);
    if (parsed) buscarPorId(val);
    else toast(resultados, "Lectura inválida del lector USB.", false);
    usbScanInput.value = "";
  }
});
function focusUsbInput() {
  usbScanInput.value = "";
  usbScanInput.focus({ preventScroll: true });
}

async function buscarPorId(expedienteId) {
  resultados.innerHTML = `<div class="border rounded-xl p-4 text-sm text-gray-600 bg-white">Buscando ${expedienteId}…</div>`;
  let expedienteData = null;
  let expedienteDocId = null;
  try {
    const direct = await getDoc(doc(db, 'expedientes', expedienteId));
    if (direct.exists()) { expedienteData = direct.data(); expedienteDocId = direct.id; }
  } catch {}
  if (!expedienteData) {
    const parsed = parseId(expedienteId);
    if (parsed) {
      const q = query(
        collection(db, 'expedientes'),
        where('codigo','==', parsed.codigo),
        where('numero','==', parsed.numero),
        where('letra','==', parsed.letra),
        where('anio','==', parsed.anio)
      );
      const snap = await getDocs(q);
      if (!snap.empty) { const d = snap.docs[0]; expedienteData = d.data(); expedienteDocId = d.id; }
    }
  }
  let movimientos = [];
  if (expedienteDocId) {
    const movQ = query(collection(db, 'expedientes', expedienteDocId, 'movimientos'));
    const movSnap = await getDocs(movQ);
    movimientos = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  if (movimientos.length === 0) {
    try {
      const cg = query(collectionGroup(db, 'movimientos'), where('expedienteId','==', expedienteId));
      const cgSnap = await getDocs(cg);
      movimientos = cgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {}
  }
  renderResultados(expedienteId, expedienteData, movimientos);
}

function renderResultados(expedienteId, expedienteData, movimientos) {
  if (!expedienteData && movimientos.length === 0) {
    resultados.innerHTML = `
      <div class="border rounded-xl p-4 bg-white">
        <div class="font-medium">Sin resultados</div>
        <div class="text-sm text-gray-600 mt-1">No se encontró información para <span class="font-mono">${expedienteId}</span>.</div>
      </div>`;
    return;
  }

  const ubic = expedienteData?.ubicacionActual || '—';
  const ubicBox = `
    <div class="mb-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl px-4 py-3">
      <div class="text-xs font-medium tracking-wide uppercase">Ubicación actual</div>
      <div class="mt-0.5 font-semibold">${ubic}</div>
    </div>`;

  const movRows = movimientos.map(m => `
    <tr>
      <td class="px-3 py-2 border-b">${m.fecha ? new Date(m.fecha.seconds*1000).toLocaleString() : '-'}</td>
      <td class="px-3 py-2 border-b">${m.tipo || '-'}</td>
      <td class="px-3 py-2 border-b">${m.actorApodo || m.actorEmail || '-'}</td>
      <td class="px-3 py-2 border-b">${m.destino || m.origen || m.area || '-'}</td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="px-3 py-6 text-center text-gray-500">Sin movimientos registrados</td></tr>`;

  resultados.innerHTML = `
    ${ubicBox}
    <div class="border rounded-xl overflow-hidden bg-white">
      <div class="px-4 py-3 bg-gray-50 border-b">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500">Expediente</div>
            <div class="font-semibold font-mono">${expedienteId}</div>
            ${expedienteData?.extracto ? `<div class="text-xs text-gray-500 mt-1">${expedienteData.extracto}</div>` : ''}
          </div>
          <div class="flex items-center gap-2">
            <a class="btn-secondary text-sm" href="#" id="resDescargarEtiqueta">Descargar etiqueta</a>
            <button class="btn-primary text-sm" id="resImprimirEtiqueta">Imprimir etiqueta</button>
          </div>
        </div>
      </div>

      <div class="p-4">
        <div class="mb-3 text-sm text-gray-500 border-b pb-2">Movimientos</div>
        <div class="overflow-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-gray-600">
                <th class="px-3 py-2 border-b">Fecha</th>
                <th class="px-3 py-2 border-b">Tipo</th>
                <th class="px-3 py-2 border-b">Actor</th>
                <th class="px-3 py-2 border-b">Origen/Destino</th>
              </tr>
            </thead>
            <tbody>${movRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  (async ()=>{
    try {
      // set etiqueta links
      const ref = doc(db, 'codigos', expedienteId);
      const snap = await getDoc(ref);
      let imageUrl;
      if (snap.exists()) imageUrl = snap.data().imageUrl;
      if (!imageUrl) {
        await generarBarcodeOnCanvas(expedienteId, 600, 240);
        imageUrl = barcodeCanvas.toDataURL('image/png');
      }
      const a = $('#resDescargarEtiqueta');
      a.href = imageUrl;
      a.setAttribute('download', `${expedienteId}.png`);
      $('#resImprimirEtiqueta').addEventListener('click', async ()=>{
        await generarBarcodeOnCanvas(expedienteId, 600, 240);
        barcodeHuman.textContent = expedienteId;
        btnDescargarPng.href = imageUrl;
        legendText.textContent = legendTextConst;
        showEl(document.getElementById('modalCodigo'));
      });
    } catch {}
  })();
}

// --- Búsqueda avanzada ---
btnBusqAvanzada.addEventListener('click', ()=>{
  busqAvanzada.classList.toggle('hidden');
});

btnLimpiarFiltros.addEventListener('click', ()=>{
  for (const el of Object.values(aInputs)) el.value = '';
});

btnBuscarAvanzado.addEventListener('click', async ()=>{
  const pmu = aInputs.aPartidaMunicipal.value.trim();
  const ppr = aInputs.aPartidaProvincial.value.trim();

  // Count other fields (no partidas)
  const otherKeys = Object.keys(aInputs).filter(k => !/PartidaMunicipal|PartidaProvincial/.test(k));
  let otherFilled = 0;
  const filters = [];

  for (const k of otherKeys) {
    const vRaw = aInputs[k].value.trim();
    if (!vRaw) continue;
    let field, v = vRaw;
    const map = {
      aCircunscripcion: 'nomenclatura.circunscripcion',
      aSeccion: 'nomenclatura.seccion',
      aChacra: 'nomenclatura.chacra',
      aLetraChacra: 'nomenclatura.letraChacra',
      aQuinta: 'nomenclatura.quinta',
      aLetraQuinta: 'nomenclatura.letraQuinta',
      aFraccion: 'nomenclatura.fraccion',
      aLetraFraccion: 'nomenclatura.letraFraccion',
      aManzana: 'nomenclatura.manzana',
      aLetraManzana: 'nomenclatura.letraManzana',
      aParcela: 'nomenclatura.parcela',
      aLetraParcela: 'nomenclatura.letraParcela'
    };
    field = map[k];
    if (!field) continue;
    if (/Letra|Seccion/i.test(k)) v = v.toUpperCase();
    else if (!isNaN(Number(v))) v = Number(v);
    filters.push({ field, op: '==', value: v });
    otherFilled++;
  }

  const hasPartida = !!pmu || !!ppr;
  if (!hasPartida && otherFilled < 2) {
    resultados.innerHTML = `<div class="border rounded-xl p-4 text-sm text-red-600 bg-white">Completá al menos 2 campos de nomenclatura o una Partida (Municipal o Provincial).</div>`;
    return;
  }

  resultados.innerHTML = `<div class="border rounded-xl p-4 text-sm text-gray-600 bg-white">Buscando…</div>`;

  try {
    let snaps = [];

    if (hasPartida) {
      if (pmu && ppr) {
        const qBoth = query(
          collection(db,'expedientes'),
          where('nomenclatura.partidaMunicipal','==', Number(pmu)),
          where('nomenclatura.partidaProvincial','==', Number(ppr))
        );
        snaps.push(await getDocs(qBoth));
      } else if (pmu) {
        const qM = query(collection(db,'expedientes'), where('nomenclatura.partidaMunicipal','==', Number(pmu)));
        snaps.push(await getDocs(qM));
      } else if (ppr) {
        const qP = query(collection(db,'expedientes'), where('nomenclatura.partidaProvincial','==', Number(ppr)));
        snaps.push(await getDocs(qP));
      }
    }

    if (filters.length) {
      let qRef = collection(db, 'expedientes');
      for (const f of filters) qRef = query(qRef, where(f.field, f.op, f.value));
      snaps.push(await getDocs(qRef));
    }

    const mapDocs = new Map();
    for (const sn of snaps) {
      sn.forEach(docSnap => mapDocs.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
    }
    const arr = [...mapDocs.values()];

    if (!arr.length) {
      resultados.innerHTML = `<div class="border rounded-xl p-4 text-sm bg-white">No se encontraron expedientes con esos filtros.</div>`;
      return;
    }

    resultados.innerHTML = `
      <div class="space-y-3">
        ${arr.map(e => `
          <div class="border rounded-xl p-3 flex items-center justify-between gap-3 bg-white">
            <div>
              <div class="font-mono font-semibold">${e.codigo}-${e.numero}-${e.letra}-${e.anio}</div>
              ${e.extracto ? `<div class="text-xs text-gray-500">${e.extracto}</div>` : ''}
              ${e.ubicacionActual ? `<div class="text-xs mt-1 text-blue-700 bg-blue-50 inline-block px-2 py-0.5 rounded">Ubicación: ${e.ubicacionActual}</div>` : ''}
            </div>
            <div class="flex items-center gap-2">
              <button class="btn-secondary text-sm" data-exp="${e.codigo}-${e.numero}-${e.letra}-${e.anio}" data-action="ver">Ver movimientos</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    $$('#resultados [data-action="ver"]').forEach(btn => {
      btn.addEventListener('click', ()=> buscarPorId(btn.getAttribute('data-exp')));
    });

  } catch (e) {
    const msg = e.__repr__ if hasattr(e,'__repr__') else str(e)
    resultados.innerHTML = `<div class="border rounded-xl p-4 text-sm text-red-600 bg-white">Falta un índice compuesto para esta combinación.</div>`;
  }
});

// --- Scanner (ZXing) ---
const modalEscaner = document.getElementById('modalEscaner');
let codeReader = null;
let currentDeviceId = null;
let currentStream = null;
let torchOn = false;

async function listCameras() {
  selCamaras.innerHTML = "";
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
  for (const d of devices) {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || `Cámara ${selCamaras.length+1}`;
    selCamaras.appendChild(opt);
  }
  if (devices[0]) currentDeviceId = devices[0].deviceId;
}

async function startScanner() {
  try {
    codeReader = new BrowserMultiFormatReader();
    await listCameras();
    await playStream(currentDeviceId);
    await startDecoding(currentDeviceId);
  } catch (e) {
    msgEscaner.textContent = "No se pudo iniciar la cámara. Verificá permisos/HTTPS.";
    msgEscaner.className = "text-sm text-red-600";
  }
}
async function playStream(deviceId) {
  stopStreamOnly();
  const constraints = { video: { deviceId: deviceId ? { exact: deviceId } : undefined, facingMode: 'environment' } };
  currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = currentStream;
  await video.play();
  await setupTorchSupport(currentStream);
}
async function startDecoding(deviceId) {
  await codeReader.decodeFromVideoDevice(deviceId, video, (result, err) => {
    if (result?.getText) {
      const text = result.getText().trim();
      const parsed = parseId(text);
      if (parsed) {
        hideEl(modalEscaner);
        stopScanner();
        setActiveTab('busqueda');
        buscarPorId(text);
      }
    }
  });
}
function stopStreamOnly() {
  if (currentStream) { currentStream.getTracks().forEach(t => t.stop()); currentStream = null; }
}
function stopScanner() {
  try { codeReader?.reset(); } catch {}
  stopStreamOnly();
  torchOn = false;
  btnLinterna.disabled = true;
  btnLinterna.textContent = "Linterna";
}
async function setupTorchSupport(stream) {
  btnLinterna.disabled = true;
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities?.();
  if (capabilities && 'torch' in capabilities) {
    btnLinterna.disabled = false;
    btnLinterna.onclick = async () => {
      try {
        torchOn = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: torchOn }] });
        btnLinterna.textContent = torchOn ? "Linterna (ON)" : "Linterna";
      } catch (e) {
        btnLinterna.disabled = true;
      }
    };
  }
}
selCamaras.addEventListener('change', async (e)=>{
  currentDeviceId = e.target.value;
  await playStream(currentDeviceId);
  await startDecoding(currentDeviceId);
});
btnEscanear.addEventListener('click', async ()=>{
  showEl(modalEscaner);
  msgEscaner.textContent = "";
  msgEscaner.className = "text-sm";
  await startScanner();
});

// --- Init ---
setActiveTab('carga');
