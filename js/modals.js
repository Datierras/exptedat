// /js/modals.js
// Utilidades para manejar los modales de #modal-overlay

const getOverlay = () => document.getElementById('modal-overlay');

export function openModal(modalEl) {
  const overlay = getOverlay();
  if (!overlay || !modalEl) return;
  overlay.classList.remove('hidden');
  modalEl.classList.remove('hidden');
}

export function closeAllModals() {
  const overlay = getOverlay();
  if (overlay) overlay.classList.add('hidden');
  document
    .querySelectorAll('#modal-overlay .modal-content')
    .forEach((m) => m.classList.add('hidden'));
}

/**
 * Vincula el cierre por:
 *  - Click en el fondo oscuro
 *  - Cualquier botón con clase .close-modal-btn
 *  - Esc (opcional)
 */
export function hookModalCloseButtons() {
  const overlay = getOverlay();
  if (!overlay) return;

  // Cerrar al hacer click en el fondo
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAllModals();
  });

  // Delegación: cualquier .close-modal-btn dentro del overlay
  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('.close-modal-btn');
    if (btn) closeAllModals();
  });

  // Cerrar con ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}
