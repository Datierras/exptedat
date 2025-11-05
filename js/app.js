// /js/app.js — versión final usando firebase-compat.js

// ====== Firebase (ya inicializado en firebase-compat.js) ======
console.log("Iniciando app.js, Firebase ya está cargado:", !!window.firebase);

// ====== Estado ======
const state = {
  currentUser: null,
  userProfile: { apodo: '' },
  scanner: null,
  scannerMode: null // 'carga' | 'busqueda'
};

// Utils
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => r.querySelectorAll(s);
const EXP_SCAN_RE = /^(\d+)[-']?(\d+)[-']?([A-Za-z])[-/'"]?(\d{4})$/;

// ====== INIT ======
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  const authContainer = $('#auth-container');
  const appContainer  = $('#app-container');
  const logoutBtn     = $('#logout-btn');
  const loginForm     = $('#login-form');
  const authError     = $('#auth-error');

  const tabCarga      = $('#tab-carga');
  const tabEtiq       = $('#tab-etiquetas');
  const tabBusqueda   = $('#tab-busqueda');
  const cargaSection  = $('#carga-section');
  const etiqSection   = $('#etiquetas-section');
  const busquedaSection = $('#busqueda-section');

  const expedienteForm    = $('#expediente-form');
  const saveExpedienteBtn = $('#save-expediente-btn');
  const settingsBtn       = $('#settings-btn');

  // ====== AUTH ======
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      state.currentUser = user;
      authContainer.classList.add('hidden');
      appContainer.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
      await loadUserProfile();

      // Tema
      const root = document.documentElement;
      const themeToggle = $('#theme-toggle');
      if (themeToggle) {
        const saved = localStorage.getItem('theme') || 'light';
        root.setAttribute('data-theme', saved);
        themeToggle.textContent = saved === 'dark' ? '☀︎' : '☽';
        themeToggle.addEventListener('click', () => {
          const cur = root.getAttribute('data-theme') || 'light';
          const next = cur === 'dark' ? 'light' : 'dark';
          root.setAttribute('data-theme', next);
          localStorage.setItem('theme', next);
          themeToggle.textContent = next === 'dark' ? '☀︎' : '☽';
        });
      }

      switchTab('carga', { tabCarga, tabEtiq, tabBusqueda, cargaSection, etiqSection, busquedaSection });
    } else {
      state.currentUser = null;
      authContainer.classList.remove('hidden');
      appContainer.classList.add('hidden');
      logoutBtn.classList.add('hidden');
    }
  });

  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#login-email').value;
      const password = $('#login-password').value;
      try {
        await auth.signInWithEmailAndPassword(email, password);
        authError.textContent = '';
        loginForm.reset();
      } catch (error) {
        handleAuthError(error, authError);
      }
    });
  }

  if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

  // Tabs
  if (tabCarga)    tabCarga.addEventListener('click', () => switchTab('carga', { tabCarga, tabEtiq, tabBusqueda, cargaSection, etiqSection, busquedaSection }));
  if (tabEtiq)     tabEtiq.addEventListener('click', () => switchTab('etiquetas', { tabCarga, tabEtiq, tabBusqueda, cargaSection, etiqSection, busquedaSection }));
  if (tabBusqueda) tabBusqueda.addEventListener('click', () => switchTab('busqueda', { tabCarga, tabEtiq, tabBusqueda, cargaSection, etiqSection, busquedaSection }));

  // Modales y configuración
  const saveSettingsBtn = $('#save-settings-btn');
  const userApodoInput  = $('#user-apodo');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      if (!state.currentUser) return;
      const apodo = (userApodoInput.value || '').trim();
      try {
        await db.collection('usuarios').doc(state.currentUser.uid).set({ apodo }, { merge: true });
        state.userProfile.apodo = apodo;
        alert('Apodo guardado correctamente.');
        closeAllModals();
      } catch (e) {
        console.error(e);
        alert('No se pudo guardar el apodo.');
      }
    });
  }

  setupExtractoAutofill();

  // Modal handlers
  $('#settings-btn')?.addEventListener('click', () => openModal($('#settings-modal')));
  $('#advanced-search-btn')?.addEventListener('click', () => openModal($('#advanced-search-modal')));
  $('#open-envio-modal-btn')?.addEventListener('click', () => openModal($('#envio-modal')));
  $('#modal-overlay')?.addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeAllModals(); });
  $$('.close-modal-btn').forEach(b => b.addEventListener('click', closeAllModals));

  // Formularios
  if (expedienteForm) expedienteForm.addEventListener('submit', (e) => onSaveExpediente(e, saveExpedienteBtn));
  attachScanHandlersFor('carga');
  attachScanHandlersFor('search');
  attachScanHandlersFor('envio');

  // Búsqueda
  const searchForm = $('#search-form');
  const searchResultsContainer = $('#search-results');
  if (searchForm) searchForm.addEventListener('submit', (e) => { e.preventDefault(); performSearch(false, searchResultsContainer); });

  // Setup de componentes
  setupLabels();
  setupEtiquetasMultiples();
  setupEnvioGrupal();
}

// ====== Helper Functions ======
function handleAuthError(error, outEl) {
  const map = {
    'auth/invalid-email': 'El formato del correo es inválido.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/too-many-requests': 'Demasiados intentos. Inténtalo más tarde.'
  };
  outEl.textContent = map[error.code] || 'Ocurrió un error inesperado.';
}

function switchTab(active, refs) {
  const { tabCarga, tabEtiq, tabBusqueda, cargaSection, etiqSection, busquedaSection } = refs;
  [tabCarga, tabEtiq, tabBusqueda].forEach(t => t.classList.remove('active'));
  [cargaSection, etiqSection, busquedaSection].forEach(s => s.classList.add('hidden'));
  if (active === 'carga') { tabCarga.classList.add('active'); cargaSection.classList.remove('hidden'); }
  if (active === 'etiquetas') { tabEtiq.classList.add('active'); etiqSection.classList.remove('hidden'); }
  if (active === 'busqueda') { tabBusqueda.classList.add('active'); busquedaSection.classList.remove('hidden'); }
}

function openModal(modal) {
  $('#modal-overlay').classList.remove('hidden');
  modal.classList.remove('hidden');
}

function closeAllModals() {
  $('#modal-overlay').classList.add('hidden');
  $$('.modal-content').forEach(m => m.classList.add('hidden'));
}

async function loadUserProfile() {
  if (!state.currentUser) return;
  const doc = await db.collection('usuarios').doc(state.currentUser.uid).get();
  if (doc.exists) {
    state.userProfile = doc.data() || {};
    $('#user-apodo').value = state.userProfile.apodo || '';
    const sel = $('#carga-oficina');
    if (sel && state.userProfile.ultimaOficina) sel.value = state.userProfile.ultimaOficina;
  }
}

// (Las funciones setupExtractoAutofill, onSaveExpediente, performSearch, etc. se mantienen igual que en tu versión anterior, no requieren cambios)
