import { $, $$, setVal, getVal } from './dom.js';
import { initTheme } from './theme.js';
import { initModals, open as openModal, closeAll as closeModals } from './modals.js';
import { parseExp } from './barcode.js';
import { initFirebaseCompat } from './firebase-compat.js';
import { Store } from './store.js';

// =================== Bootstrap base ===================
initTheme();
initModals();

// Firebase compat + objetos
const { auth, db, Timestamp } = initFirebaseCompat();

// Selectores base
const authContainer = $("#auth-container");
const appContainer  = $("#app-container");
const logoutBtn     = $("#logout-btn");
const loginForm     = $("#login-form");
const authError     = $("#auth-error");

// Tabs
const tabCarga     = $("#tab-carga");
const tabEtiquetas = $("#tab-etiquetas");       // si aún no existe, no pasa nada
const tabBusqueda  = $("#tab-busqueda");
const cargaSection     = $("#carga-section");
const etiquetasSection = $("#etiquetas-section"); // puede ser null hasta Fase 2
const busquedaSection  = $("#busqueda-section");

// Modales
const settingsBtn     = $("#settings-btn");
const settingsModal   = $("#settings-modal");
const saveSettingsBtn = $("#save-settings-btn");
const userApodoInput  = $("#user-apodo");

// ========= Auth =========
auth.onAuthStateChanged(user => {
  Store.currentUser = user || null;
  if (user) {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loadUserProfile();
  } else {
    appContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
  }
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await auth.signInWithEmailAndPassword($('#login-email').value, $('#login-password').value);
    authError.textContent = '';
  } catch (err) {
    console.error(err);
    authError.textContent = 'Correo o contraseña incorrectos.';
  }
});
logoutBtn?.addEventListener('click', () => auth.signOut());

async function loadUserProfile() {
  if (!Store.currentUser) return;
  const snap = await db.collection('usuarios').doc(Store.currentUser.uid).get();
  if (snap.exists) {
    Store.userProfile = snap.data() || {};
    if (userApodoInput) userApodoInput.value = Store.userProfile.apodo || '';
  }
}

// ========= Modales =========
settingsBtn?.addEventListener('click', () => openModal(settingsModal));
saveSettingsBtn?.addEventListener('click', async () => {
  if (!Store.currentUser) return alert('Iniciá sesión primero');
  const apodo = (userApodoInput?.value || '').trim();
  try {
    await db.collection('usuarios').doc(Store.currentUser.uid).set({ apodo }, { merge: true });
    Store.userProfile.apodo = apodo;
    alert('Apodo guardado.');
    closeModals();
  } catch (e) {
    console.error(e);
    alert('No se pudo guardar.');
  }
});

// ========= Tabs =========
function switchTab(which) {
  [tabCarga, tabEtiquetas, tabBusqueda].forEach(b => b?.classList.remove('active'));
  [cargaSection, etiquetasSection, busquedaSection].forEach(s => s?.classList.add('hidden'));

  if (which === 'carga') {
    tabCarga?.classList.add('active');
    cargaSection?.classList.remove('hidden');
  } else if (which === 'etiquetas') {
    tabEtiquetas?.classList.add('active');
    etiquetasSection?.classList.remove('hidden');
  } else {
    tabBusqueda?.classList.add('active');
    busquedaSection?.classList.remove('hidden');
  }
}
tabCarga?.addEventListener('click', () => switchTab('carga'));
tabEtiquetas?.addEventListener('click', () => switchTab('etiquetas'));
tabBusqueda?.addEventListener('click', () => switchTab('busqueda'));
switchTab('carga'); // default

// ========= HID: distribuir lecturas en carga/búsqueda =========
['#carga-codigo','#carga-numero','#carga-letra','#carga-anio',
 '#search-codigo','#search-numero','#search-letra','#search-anio'].forEach(sel => {
  const el = document.querySelector(sel);
  if (!el) return;

  const tryDistribute = () => {
    const v = el.value.trim();
    if (v.length < 8) return;
    const p = parseExp(v);
    if (!p) return;
    const prefix = sel.startsWith('#search') ? 'search' : 'carga';
    setVal(`${prefix}-codigo`, p.codigo);
    setVal(`${prefix}-numero`, p.numero);
    setVal(`${prefix}-letra`,  p.letra);
    setVal(`${prefix}-anio`,   p.anio);
    el.value = '';
  };

  el.addEventListener('input', tryDistribute);
  el.addEventListener('change', tryDistribute);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') tryDistribute();
  });
});

// ========= (Hooks para Fase 2) =========
// - search.js → initSearch({ db, Timestamp })
// - labels.js → initLabels({ JsBarcode, jsPDF })
// - scanner.js → initScanner({ openModal, closeModals, ... })
// - envio.js   → initEnvio({ db, Timestamp, openModal, ... })

console.log('[init] Fase 1 lista: tema, modales, auth, HID parser.');
