
export async function performSearch(isAdvanced = false) {
  console.log('[search] start, isAdvanced =', isAdvanced);
  searchResultsContainer.innerHTML = '<p>Buscando...</p>';

  try {
    let base = db.collection('expedientes');

    if (isAdvanced) {
      console.log('[search] avanzada');
      const advValues = {
        'nomen.circunscripcion': $('#adv-nomen-circ')?.value || '',
        'nomen.seccion':         $('#adv-nomen-secc')?.value || '',
        'nomen.chacra':          $('#adv-nomen-chac')?.value || '',
        'nomen.quinta':          $('#adv-nomen-quin')?.value || '',
        'nomen.manzana':         $('#adv-nomen-manz')?.value || '',
        'nomen.parcela':         $('#adv-nomen-parc')?.value || '',
        'partidas.prov':         $('#adv-part-prov')?.value || '',
        'partidas.mun':          $('#adv-part-mun')?.value || '',
      };
      for (const key in advValues) {
        const val = advValues[key].trim();
        if (val) base = base.where(key, '==', val);
      }
      const extracto = $('#search-extracto')?.value.trim();
      if (extracto) {
        base = base.where('extracto', '>=', extracto)
                   .where('extracto', '<=', extracto + '\uf8ff');
      }
      base = base.orderBy('createdAt', 'desc');
      closeAllModals();

      const snap = await base.get();
      console.log('[search] avanzada, size=', snap.size);
      return renderSearchResults(snap);
    }

    // Búsqueda normal
    const codigo = $('#search-codigo')?.value.trim();
    const numero = $('#search-numero')?.value.trim();
    const letra  = ($('#search-letra')?.value || '').trim().toUpperCase();
    const anio   = $('#search-anio')?.value.trim();
    const extracto = $('#search-extracto')?.value.trim();

    if (!numero) {
      searchResultsContainer.innerHTML = `
        <p class="error-message">
          Para la búsqueda normal, el campo <strong>Número</strong> es obligatorio. 
          Usá <strong>Búsqueda Avanzada</strong> si no tenés el número.
        </p>`;
      console.warn('[search] falta numero');
      return;
    }

    let q1 = base;
    if (codigo) q1 = q1.where('codigo', '==', codigo);
    q1 = q1.where('numero', '==', numero);
    if (letra)  q1 = q1.where('letra',  '==', letra);
    if (anio)   q1 = q1.where('anio',   '==', anio);
    if (extracto) {
      q1 = q1.where('extracto', '>=', extracto)
             .where('extracto', '<=', extracto + '\uf8ff');
    }
    q1 = q1.orderBy('createdAt', 'desc');

    let snap = await q1.get();
    console.log('[search] intento string, size=', snap.size);

    if (snap.empty && !isNaN(Number(numero))) {
      let q2 = base;
      if (codigo) q2 = q2.where('codigo', '==', codigo);
      q2 = q2.where('numero', '==', Number(numero));
      if (letra)  q2 = q2.where('letra',  '==', letra);
      if (anio)   q2 = q2.where('anio',   '==', anio);
      if (extracto) {
        q2 = q2.where('extracto', '>=', extracto)
               .where('extracto', '<=', extracto + '\uf8ff');
      }
      q2 = q2.orderBy('createdAt', 'desc');

      try {
        const snap2 = await q2.get();
        console.log('[search] intento number, size=', snap2.size);
        snap = snap2;
      } catch (e2) {
        console.error('[search] fallo intento number:', e2);
      }
    }

    renderSearchResults(snap);

  } catch (error) {
    console.error('Error en la búsqueda:', error);
    searchResultsContainer.innerHTML = `
      <p class="error-message">
        Error al buscar. Puede requerirse un <strong>índice compuesto</strong> en Firestore.
        Revisá la consola (F12) para el enlace sugerido.
      </p>`;
  }
}
