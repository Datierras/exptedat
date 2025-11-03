import { $, $$, toggle } from './dom.js';

let overlay, modals;

export function initModals() {
  overlay = $('#modal-overlay');
  modals  = $$('#modal-overlay .modal-content');

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeAll();
  });

  $$('.close-modal-btn').forEach(btn => btn.addEventListener('click', closeAll));
}

export function open(el) {
  if (!el) return;
  toggle(overlay, true);
  el.classList.remove('hidden');
}

export function closeAll() {
  toggle(overlay, false);
  modals.forEach(m => m.classList.add('hidden'));
}
