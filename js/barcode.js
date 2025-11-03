// Funciones puras para parsear y formatear códigos de expediente
const EXP_SCAN_RE = /^(\d+)[-']?(\d+)[-']?([A-Za-z])[-/'"]?(\d{4})$/;

export function parseExp(str) {
  const m = (str || '').trim().match(EXP_SCAN_RE);
  if (!m) return null;
  const [, c, n, l, a] = m;
  return { codigo: c, numero: n, letra: l.toUpperCase(), anio: a };
}

export function formatHuman({ codigo, numero, letra, anio }) {
  return `${codigo}-${numero}-${letra}/${anio}`;
}
export function formatMachine({ codigo, numero, letra, anio }) {
  return `${codigo}-${numero}-${letra}-${anio}`;
}
