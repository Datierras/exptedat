  export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => r.querySelectorAll(s);

export function setText(el, txt) { if (el) el.textContent = txt; }
export function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}
export function getVal(id) {
  const el = document.getElementById(id);
  return el ? (el.value ?? '').toString() : '';
}
export function toggle(el, on=true) {
  if (!el) return;
  el.classList[on ? 'remove' : 'add']('hidden');
}
