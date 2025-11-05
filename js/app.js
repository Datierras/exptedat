// ===== Extracto: autofill + lock (mejorado) =====
function setupExtractoAutofill() {
  const numeroInp   = $('#carga-numero');
  const letraInp    = $('#carga-letra');
  const anioInp     = $('#carga-anio');
  const extractoInp = $('#carga-extracto');
  if (!numeroInp || !letraInp || !anioInp || !extractoInp) return;

  // Botón para bloquear/editar
  let toggleBtn = $('#toggle-extracto-edit');
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggle-extracto-edit';
    toggleBtn.type = 'button';
    toggleBtn.textContent = 'Editar extracto';
    toggleBtn.className = 'btn btn-secondary ml-2';
    extractoInp.insertAdjacentElement('afterend', toggleBtn);
  }

  function lockExtracto(lock = true) {
    extractoInp.readOnly = lock;
    extractoInp.classList.toggle('readonly', lock);
    toggleBtn.textContent = lock ? 'Editar extracto' : 'Bloquear extracto';
  }

  // Busca el último extracto por:
  // 1) número + letra + año (preferido)
  // 2) si falta letra o año, por número solo (fallback)
  async function fetchLastExtracto() {
    const numeroRaw = (numeroInp.value || '').trim();
    const letra     = (letraInp.value  || '').trim().toUpperCase();
    const anio      = (anioInp.value   || '').trim();

    if (!numeroRaw) return;

    // Probar número como number y como string
    const numAsNumber = Number(numeroRaw);
    const numCandidates = isNaN(numAsNumber)
      ? [numeroRaw]
      : [numAsNumber, String(numeroRaw)];

    // Helper para armar y ejecutar la query con filtros disponibles
    async function runQuery(numeroVal, exact) {
      // exact=true => exige letra y año si están completos
      let q = db.collection('expedientes').where('numero', '==', numeroVal);

      if (exact) {
        if (letra) q = q.where('letra', '==', letra);
        if (anio)  q = q.where('anio', '==', anio);
      }

      q = q.orderBy('createdAt', 'desc').limit(1);
      try {
        const snap = await q.get();
        return snap.empty ? null : snap.docs[0].data();
      } catch (e) {
        // Si Firestore pide índice, lo atrapamos silenciosamente;
        // en ese caso probamos el fallback menos restrictivo abajo.
        return null;
      }
    }

    // 1) Preferir coincidencia exacta si letra/anio están completos
    if (letra && anio) {
      for (const n of numCandidates) {
        const data = await runQuery(n, true);
        if (data && data.extracto) {
          if (!extractoInp.dataset.userEdited) {
            extractoInp.value = data.extracto;
            extractoInp.dataset.autofilled = '1';
            lockExtracto(true);
          }
          return;
        }
      }
    }

    // 2) Fallback: si falta letra o año, buscar por número solo (último registro)
    for (const n of numCandidates) {
      const data = await runQuery(n, false);
      if (data && data.extracto) {
        if (!extractoInp.dataset.userEdited) {
          extractoInp.value = data.extracto;
          extractoInp.dataset.autofilled = '1';
          lockExtracto(true);
        }
        return;
      }
    }

    // Si no se encontró nada, permitir editar normalmente
    lockExtracto(false);
  }

  // Marcar si el usuario tocó el extracto (para no sobreescribir su edición)
  extractoInp.addEventListener('input', () => { extractoInp.dataset.userEdited = '1'; });

  // Toggle de bloqueo
  toggleBtn.addEventListener('click', () => lockExtracto(!extractoInp.readOnly));

  // Disparadores: cuando cambien número/letra/año, intentamos autocompletar
  ['input', 'change', 'blur'].forEach(evt => {
    numeroInp.addEventListener(evt, fetchLastExtracto);
    letraInp.addEventListener(evt,  fetchLastExtracto);
    anioInp.addEventListener(evt,   fetchLastExtracto);
  });

  // Primer intento al cargar
  fetchLastExtracto();
}
