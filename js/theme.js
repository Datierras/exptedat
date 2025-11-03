// /js/theme.js
// Manejo de tema claro/oscuro con icono monocromo y persistencia en localStorage.

const THEME_KEY = 'theme';
const LIGHT = 'light';
const DARK = 'dark';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  // Icono SVG monocromo para evitar emojis amarillos
  const sun = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4V2M12 22v-2M4.22 4.22 5.64 5.64M18.36 18.36l1.41 1.41M2 12h2M20 12h2M4.22 19.78 5.64 18.36M18.36 5.64l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/></svg>';
  const moon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" fill="none"/></svg>';

  btn.innerHTML = theme === DARK ? sun : moon; // si está oscuro muestro Sol (para pasar a claro)
  btn.setAttribute('aria-label', theme === DARK ? 'Cambiar a claro' : 'Cambiar a oscuro');
}

export function getSavedTheme() {
  return localStorage.getItem(THEME_KEY) || LIGHT;
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme() {
  const next = getSavedTheme() === DARK ? LIGHT : DARK;
  setTheme(next);
}

/**
 * Inicializa el botón #theme-toggle y aplica el tema guardado.
 * Exportamos con este nombre porque es lo que importa app.js.
 */
export function initThemeToggle() {
  const current = getSavedTheme();
  applyTheme(current);
  const btn = document.getElementById('theme-toggle');
  if (btn && !btn.dataset.bound) {
    btn.addEventListener('click', toggleTheme);
    btn.dataset.bound = '1';
  }
}

// También exporto un init por si en algún momento preferís otro nombre
export function initTheme() {
  initThemeToggle();
}

export default { initThemeToggle, initTheme, getSavedTheme, setTheme, toggleTheme };
