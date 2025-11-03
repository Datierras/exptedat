// /js/app.js
// Inicialización de pestañas, auth y modales. Se apoya en otros módulos.

import { initThemeToggle } from './theme.js';
import { openModal, closeAllModals, hookModalCloseButtons } from './modals.js';
import { auth, db, Timestamp } from './firebase-compat.js';
import { initLabelsTab } from './labels.js';

// Utilidades DOM
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Estado simple
const state = {
  currentUser: null,
};

// ---------- TABS ----------
function switchTab(tab) {
  const map = {
    carga:     { btn: '#tab-carga',     sec: '#carga-section' },
    etiquetas: { btn: '#tab-etiquetas', sec: '#etiquetas-section' },
    busqueda:  { btn: '#tab-busqueda',  sec: '#busqueda-section' },
  };

  Object.values(map).forEach(({btn, sec}) => {
    $(btn).classList.remove('active');
    $(sec).classList.add('hidden');
  });

  const target = map[tab] || map.carga;
  $(target.btn).classList.add('active');
  $(target.sec).classList.remove('hidden');
}

function initTabs() {
  $('#tab-carga').addEventListener('click', () => switchTab('carga'));
  $('#tab-etiquetas').addEventListener('click', () => switchTab('etiquetas'));
  $('#tab-busqueda').addEventListener('click', () => switchTab('busqueda'));
}

// ---------- AUTH ----------
function bindAuthUI() {
  const loginForm = $('#login-form');
  const authError = $('#auth-error');
  const logoutBtn = $('#logout-btn');
  const authContainer = $('#auth-container');
  const appContainer  = $('#app-container');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const pass  = $('#login-password').value.trim();
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      authError.textContent = '';
    } catch (err) {
      authError.textContent = 'Error de autenticación.';
      console.error(err);
    }
  });

  logoutBtn.addEventListener('click', () => auth.signOut());

  auth.onAuthStateChanged((user) => {
    state.currentUser = user || null;
    if (user) {
      authContainer.classList.add('hidden');
      appContainer.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
    } else {
      authContainer.classList.remove('hidden');
      appContainer.classList.add('hidden');
      logoutBtn.classList.add('hidden');
    }
  });
}

// ---------- MODALES ----------
function bindModals() {
  hookModalCloseButtons();
  $('#settings-btn').addEventListener('click', () => {
    openModal($('#settings-modal'));
  });
}

// ---------- INICIALIZACIÓN ----------
window.addEventListener('DOMContentLoaded', () => {
  // Firebase compat listo
  firebaseInit();

  // Theme (icono se dibuja desde CSS con data-theme)
  initThemeToggle();

  // Tabs + default
  initTabs();
  switchTab('carga');

  // Modales
  bindModals();

  // Auth
  bindAuthUI();

  // Tab de ETIQUETAS
  initLabelsTab();
});
