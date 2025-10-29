// app.js (FINAL)

// --- Inicialización de Firebase y Constantes Globales ---
// Usar la sintaxis v8 compatible con los scripts del HTML
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const Timestamp = firebase.firestore.Timestamp;

// Estado de la aplicación
const state = {
  currentUser: null,
  userProfile: { apodo: '' },
  scanner: null,
  scannerMode: null, // 'carga' o 'busqueda'
};

// --- Selectores del DOM ---
const $  = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const authContainer = $('#auth-container');
const appContainer  = $('#app-container');
const logoutBtn     = $('#logout-btn');
const loginForm     = $('#login-form');
const authError     = $('#auth-error');

const tabCarga      = $('#tab-carga');
const tabBusqueda   = $('#tab-busqueda');
const cargaSection  = $('#carga-section');
const busquedaSection = $('#busqueda-section');

const expedienteForm   = $('#expediente-form');
const saveExpedienteBtn= $('#save-expediente-btn');
const settingsBtn      = $('#settings-btn');

const modalOverlay     = $('#modal-overlay');
const allModals        = $$('.modal-content');
const settingsModal    = $('#settings-modal');
const advancedSearchModal = $('#advanced-search-modal');
const scannerModal     = $('#scanner-modal');
const labelModal       = $('#label-modal');
const scannerVideo     = $('#scanner-video');
const cameraSelect     = $('#camera-select');
const scanCargaBtn     = $('#scan-carga-btn');
const scanBusquedaBtn  = $('#scan-busqueda-btn');
const scannerFeedback  = $('#scanner-feedback'); // Para mostrar mensajes en el modal de cámara

// Elementos de Carga
const cargaCodigo  = $('#carga-codigo');
const cargaNumero  = $('#carga-numero');
const cargaLetra   = $('#carga-letra');
const cargaAnio    = $('#carga-anio');
const cargaOficina = $('#carga-oficina');
const cargaExtracto = $('#carga-extracto');
const movimientoRadios = $$('input[name="movimiento"]');

// Elementos de Búsqueda
const searchForm = $('#search-form');
const searchCodigo = $('#search-codigo');
const searchNumero = $('#search-numero');
const searchLetra  = $('#search-letra');
const searchAnio   = $('#search-anio');
const searchExtracto = $('#search-extracto');
const searchResults  = $('#search-results');
const clearSearchBtn = $('#clear-search-btn');
const advancedSearchBtn = $('#advanced-search-btn');

// --- Funciones de Utilidad ---
function getFullExpedienteId(exp) {
    const letra = exp.letra.toUpperCase() || 'S'; // 'S' de Sin letra si no está
    const codigo = String(exp.codigo || '0000').padStart(4, '0');
    const numero = String(exp.numero || '00000').padStart(5, '0');
    const anio = String(exp.anio || '0000').padStart(4, '0');
    return `${codigo}-${numero}-${letra}-${anio}`;
}

// Genera un ID legible para mostrar
function getDisplayId(exp) {
    return `${exp.codigo || ''}-${exp.numero || ''}-${exp.letra || ''}/${exp.anio || ''}`;
}

// Detener pistas de media (cámara)
function stopMediaTracks(video) {
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
}

// Limpia el formulario de carga
function resetCargaForm() {
    expedienteForm.reset();
    // Restablecer campos de nomenclatura avanzados a vacío
    $$('.dropdown-content input[type="text"]').forEach(input => input.value = '');
}

// Función de Búsqueda (simplificada para este ejemplo)
function performSearch() {
    // Implementación de la búsqueda en Firestore (ejemplo)
    searchResults.innerHTML = '<p class="loading-message">Buscando...</p>';
    
    // Simulación de búsqueda (reemplaza con tu lógica real de Firestore)
    setTimeout(async () => {
        try {
            // Obtener valores de búsqueda (solo los campos principales)
            const codigo = searchCodigo.value.trim();
            const numero = searchNumero.value.trim();
            const letra = searchLetra.value.trim().toUpperCase();
            const anio = searchAnio.value.trim();
            const extracto = searchExtracto.value.trim();

            let results = [];
            // Aquí iría tu query de Firestore. Por ahora, simulación:
            if (numero || extracto) {
                results = [{
                    id: 'exp123',
                    codigo: codigo || '4078',
                    numero: numero || '12345',
                    letra: letra || 'I',
                    anio: anio || '2025',
                    extracto: 'Ejemplo de extracto del expediente encontrado.',
                    oficina: 'D.G. de Ingreso de Tierras',
                    movimiento: 'Recibimos',
                    fecha: new Date().toLocaleDateString('es-AR'),
                    nomenclatura: { circ: '1', secc: 'D', manz: '12', parc: '03' }
                }];
            } else {
                searchResults.innerHTML = '<p class="empty-message">Por favor, ingresa al menos el Número para buscar.</p>';
                return;
            }

            if (results.length === 0) {
                searchResults.innerHTML = '<p class="empty-message">No se encontraron expedientes con esos criterios.</p>';
            } else {
                searchResults.innerHTML = '';
                results.forEach(exp => {
                    const resultDiv = document.createElement('div');
                    resultDiv.className = 'result-item';
                    const fullId = getDisplayId(exp);
                    resultDiv.innerHTML = `
                        <div class="result-header">
                            <h3>Expediente: ${fullId}</h3>
                            <span class="movement ${exp.movimiento === 'Recibimos' ? 'recibimos' : 'enviamos'}">${exp.movimiento}</span>
                        </div>
                        <p><strong>Extracto:</strong> ${exp.extracto}</p>
                        <p><strong>Última Oficina:</strong> ${exp.oficina}</p>
                        <p><strong>Fecha:</strong> ${exp.fecha}</p>
                        <div class="result-actions">
                            <button class="action-view" data-id="${exp.id}">Ver Detalle</button>
                            <button class="action-track" data-id="${exp.id}">Generar Tránsito</button>
                        </div>
                    `;
                    searchResults.appendChild(resultDiv);
                });
            }
        } catch (error) {
            console.error("Error en la búsqueda:", error);
            searchResults.innerHTML = `<p class="error-message">Error al buscar: ${error.message}</p>`;
        }
    }, 500); // Pequeño delay de simulación
}

// --- Lógica de Auth y Carga Inicial ---
auth.onAuthStateChanged(user => {
    if (user) {
        state.currentUser = user;
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        // Cargar perfil de usuario o configurar uno nuevo
        loadUserProfile(user.uid);
    } else {
        state.currentUser = null;
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        logoutBtn.classList.add('hidden');
    }
});

// Función para cargar perfil (apodo)
async function loadUserProfile(uid) {
    const userDocRef = db.collection('users').doc(uid);
    const doc = await userDocRef.get();
    if (doc.exists) {
        state.userProfile = doc.data();
    } else {
        // Crear perfil inicial si no existe
        state.userProfile.apodo = 'Usuario';
        userDocRef.set(state.userProfile);
    }
    // Asigna el apodo al campo de configuración al cargar
    $('#user-apodo').value = state.userProfile.apodo;
}

// Manejador de Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#login-email').value;
    const password = $('#login-password').value;
    authError.textContent = '';
    
    // Simulación de autenticación (reemplaza con tu lógica real de Firebase Auth)
    if (email === 'datierras@ejemplo.com' && password === '123456') {
        // En una app real de Firebase, usarías signInWithEmailAndPassword
        // Por ahora, solo simulación exitosa.
        auth.signInAnonymously().catch(error => {
            authError.textContent = 'Error de inicio de sesión simulado: ' + error.message;
            console.error(error);
        });
    } else {
        authError.textContent = 'Credenciales de prueba incorrectas. Use: datierras@ejemplo.com / 123456';
    }
});

// Manejador de Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut().catch(error => console.error('Error al cerrar sesión:', error));
});


// --- Lógica de Navegación (Pestañas) ---
function setActiveTab(tabId) {
    const sections = {
        'tab-carga': cargaSection,
        'tab-busqueda': busquedaSection
    };

    $$('.tab-btn').forEach(btn => btn.classList.remove('active'));
    $$('.content-section').forEach(section => section.classList.add('hidden'));

    $('#' + tabId).classList.add('active');
    sections[tabId].classList.remove('hidden');

    // Al cambiar a carga, asegurar que el campo de Número de Carga reciba el foco
    if (tabId === 'tab-carga') {
        cargaNumero.focus(); 
    }
}

tabCarga.addEventListener('click', () => setActiveTab('tab-carga'));
tabBusqueda.addEventListener('click', () => setActiveTab('tab-busqueda'));


// --- Lógica de Persistencia (LocalStorage/Tema) ---
const themeToggle = $('#theme-toggle');

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', toggleTheme);
// Inicializa el ícono según el tema actual al cargar
document.addEventListener('DOMContentLoaded', () => {
    const initialTheme = localStorage.getItem('theme') || 'light';
    themeToggle.textContent = initialTheme === 'dark' ? '☀️' : '🌙';
});


// --- Lógica de Formularios y Funciones Principales ---

// Manejador del Dropdown de Nomenclatura
const dropdownToggle = $('.dropdown-toggle');
dropdownToggle.addEventListener('click', () => {
    const content = dropdownToggle.nextElementSibling;
    content.classList.toggle('active');
    const arrow = dropdownToggle.querySelector('.arrow');
    if (content.classList.contains('active')) {
        arrow.textContent = '▼';
    } else {
        arrow.textContent = '▶';
    }
});

// Manejador de Guardar Expediente
expedienteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.currentUser) {
        console.error("Usuario no autenticado para guardar.");
        return;
    }
    
    // Obtener datos del formulario de carga
    const nuevoExpediente = {
        codigo: cargaCodigo.value.trim(),
        numero: parseInt(cargaNumero.value.trim()),
        letra: cargaLetra.value.trim().toUpperCase(),
        anio: parseInt(cargaAnio.value.trim()),
        extracto: cargaExtracto.value.trim(),
        oficina: cargaOficina.value,
        movimiento: $('input[name="movimiento"]:checked').value,
        fecha: Timestamp.fromDate(new Date()),
        nomenclatura: {
            circ: $('#nomen-circ').value.trim(),
            secc: $('#nomen-secc').value.trim(),
            chac: $('#nomen-chac').value.trim(),
            lch: $('#nomen-lch').value.trim(),
            quin: $('#nomen-quin').value.trim(),
            lqt: $('#nomen-lqt').value.trim(),
            frac: $('#nomen-frac').value.trim(),
            lfr: $('#nomen-lfr').value.trim(),
            manz: $('#nomen-manz').value.trim(),
            lmz: $('#nomen-lmz').value.trim(),
            parc: $('#nomen-parc').value.trim(),
            lpc: $('#nomen-lpc').value.trim(),
            partProv: $('#part-prov').value.trim(),
            partMun: $('#part-mun').value.trim(),
        },
        creadoPor: state.userProfile.apodo, // Usar el apodo guardado
        usuarioId: state.currentUser.uid // ID de Firebase del usuario
    };

    // Validación básica
    if (isNaN(nuevoExpediente.numero) || isNaN(nuevoExpediente.anio)) {
        // NO USAR ALERT. Usar un mensaje en pantalla o modal.
        console.error('Número o Año inválidos.');
        return;
    }

    // Guardar en Firestore (simulación)
    console.log("Guardando expediente:", nuevoExpediente);
    // Aquí iría el código real de addDoc o setDoc
    
    // Simulación de éxito
    // Usar un mensaje temporal en la interfaz
    saveExpedienteBtn.textContent = '¡Guardado!';
    saveExpedienteBtn.disabled = true;
    setTimeout(() => {
        saveExpedienteBtn.textContent = 'Guardar expediente';
        saveExpedienteBtn.disabled = false;
        resetCargaForm();
    }, 1500);
});

// Manejador del formulario de búsqueda
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    performSearch();
});

// Manejador de limpiar búsqueda
clearSearchBtn.addEventListener('click', () => {
    searchForm.reset();
    searchResults.innerHTML = '';
});

// Manejador de búsqueda avanzada (simplemente cierra el modal y simula la búsqueda principal)
$('#advanced-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    closeAllModals();
    // En una app real, aquí se llamaría a performAdvancedSearch()
    console.log('Búsqueda avanzada simulada. Usarás los campos de nomenclatura.');
});

// --- Lógica de Escaneo por Teclado (Pistola USB) (MEJORA CLAVE) ---

/**
 * Procesa la cadena de texto del escáner (ej: 4078-12345-I-2025)
 * y llena los campos del formulario de CARGA.
 * @param {string} barcodeValue El valor leído por el escáner USB.
 */
function processBarcodeForCarga(barcodeValue) {
    const value = barcodeValue.trim().toUpperCase();
    
    // El patrón esperado es CODIGO-NUMERO-LETRA-AÑO (ej: 4078-12345-I-2025)
    // ^(\d+): Código (uno o más dígitos)
    // -(\d+): Número (uno o más dígitos)
    // -([A-Z]): Letra (una sola mayúscula)
    // -(\d{4})$: Año (cuatro dígitos)
    const regex = /^(\d+)-(\d+)-([A-Z])-(\d{4})$/; 
    const match = value.match(regex);
    
    if (match) {
        // Llenar los campos de CARGA
        cargaCodigo.value  = match[1];
        cargaNumero.value  = match[2];
        cargaLetra.value   = match[3];
        cargaAnio.value    = match[4];
        
        // Mostrar un mensaje de éxito breve
        scannerFeedback.textContent = `Código: ${value} cargado.`;
        // Mover el foco al siguiente campo principal (Extracto)
        cargaExtracto.focus(); 

        // Limpiar el mensaje de feedback después de un tiempo
        setTimeout(() => scannerFeedback.textContent = 'Apunte la cámara al código de barras...', 3000);
        
    } else {
        // Si el formato es incorrecto, limpiamos el campo de Número
        cargaNumero.value = ''; 
        scannerFeedback.textContent = 'ERROR: Código no reconocido. Formato esperado: CODIGO-NUMERO-LETRA-AÑO';
        setTimeout(() => scannerFeedback.textContent = 'Apunte la cámara al código de barras...', 5000);
    }
}

// Escuchamos la entrada del campo 'Número' en el formulario de CARGA
// El escáner USB, después de escribir, suele enviar un Enter, lo que dispara el evento 'change'.
cargaNumero.addEventListener('change', (e) => {
    // Solo procesamos si la pestaña de CARGA está activa
    if (!cargaSection.classList.contains('hidden')) {
        const value = e.target.value;
        // Solo procesamos si el valor parece un código de barras completo (contiene guiones)
        if (value.includes('-')) { 
            processBarcodeForCarga(value);
        }
    }
});
// También escuchamos el campo Número de Búsqueda para el mismo efecto en la pestaña de BÚSQUEDA
searchNumero.addEventListener('change', (e) => {
    if (!busquedaSection.classList.contains('hidden')) {
        const value = e.target.value;
        if (value.includes('-')) { 
            // Reutilizamos la lógica, pero llenando los campos de búsqueda
            const regex = /^(\d+)-(\d+)-([A-Z])-(\d{4})$/; 
            const match = value.match(regex);
            if (match) {
                searchCodigo.value  = match[1];
                searchNumero.value  = match[2];
                searchLetra.value   = match[3];
                searchAnio.value    = match[4];
                performSearch();
            } else {
                searchNumero.value = '';
                scannerFeedback.textContent = 'ERROR: Código de búsqueda inválido.';
                setTimeout(() => scannerFeedback.textContent = 'Apunte la cámara al código de barras...', 5000);
            }
        }
    }
});


// --- Lógica de Generación de Etiqueta (Código de Barras y PDF) (MEJORA CLAVE) ---
$('#generate-label-btn').addEventListener('click', () => {
    const expData = {
        codigo: cargaCodigo.value.trim(),
        numero: cargaNumero.value.trim(),
        letra: cargaLetra.value.trim(),
        anio: cargaAnio.value.trim(),
    };

    if (!expData.codigo || !expData.numero || !expData.letra || !expData.anio) {
        // Usar un mensaje en el modal en lugar de alert
        scannerFeedback.textContent = 'ERROR: Completa Código, Número, Letra y Año para la etiqueta.';
        setTimeout(() => scannerFeedback.textContent = 'Apunte la cámara al código de barras...', 5000);
        return;
    }

    const fullId = getFullExpedienteId(expData);
    const displayId = getDisplayId(expData);

    $('#label-id-text').textContent = `Expediente: ${displayId}`;

    // GENERACIÓN DE CÓDIGO DE BARRAS MEJORADA
    JsBarcode("#barcode", fullId, {
        format: "CODE39",
        displayValue: true,
        text: fullId,
        // Aumentar el ancho (width) para una mejor lectura con la pistola USB
        width: 2, 
        height: 80, // Aumentar la altura
        margin: 10,
        textMargin: 5,
        fontSize: 18 // Aumentar el tamaño de la fuente para mejor legibilidad
    });

    openModal(labelModal);
});

// Imprimir Etiqueta
$('#print-label-btn').addEventListener('click', () => {
    const printContent = $('#label-content').outerHTML;
    const originalBody = document.body.innerHTML;

    // Estilos de impresión mejorados para centrar y dimensionar
    document.body.innerHTML = `
        <style>
            @media print {
                /* Oculta todo excepto el área de impresión */
                body * { visibility: hidden; }
                #print-area, #print-area * { visibility: visible; }
                
                /* Estilos del contenedor */
                #print-area {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    text-align: center;
                    box-sizing: border-box;
                    padding: 5mm; 
                }
                
                #label-content {
                    display: inline-block;
                    border: 1px solid black;
                    padding: 5mm;
                    margin: 0 auto;
                    width: 90mm; /* Ancho de etiqueta común */
                }
                
                /* Asegurar que el SVG del código de barras tome el 100% del contenedor de la etiqueta */
                #barcode { 
                    width: 100%; 
                    height: auto; 
                }
            }
        </style>
        <div id="print-area">${printContent}</div>
    `;

    window.print();

    // Restaurar contenido original después de imprimir (con un pequeño retraso)
    setTimeout(() => {
        document.body.innerHTML = originalBody;
        location.reload(); // Recarga la página para restaurar scripts, etc.
    }, 100);
});

// Generar PDF (usando jspdf)
$('#pdf-label-btn').addEventListener('click', () => {
    // Necesitas la biblioteca window.jspdf.jsPDF
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        console.error('Error: La librería jsPDF no está cargada correctamente.');
        // Sustituir alert con un feedback visual
        scannerFeedback.textContent = 'Error: Librería PDF no cargada.';
        setTimeout(() => scannerFeedback.textContent = 'Apunte la cámara al código de barras...', 5000);
        return;
    }

    const { jsPDF } = window.jspdf;
    // Tamaño de etiqueta común: 100mm x 60mm (horizontal)
    const doc = new jsPDF('l', 'mm', [100, 60]); 

    // Obtener el SVG del código de barras
    const svgElement = $('#barcode');
    const fullIdText = $('#label-id-text').textContent;
    
    // Convertir SVG a imagen para el PDF
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Usamos Data URL para asegurar que el SVG se renderice correctamente
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = function() {
        // Establecer dimensiones del canvas 
        // 500x150 es un buen tamaño para la imagen del código de barras
        canvas.width = 500; 
        canvas.height = 150;

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height); // Fondo blanco

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imgData = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url); // Liberar la URL del blob

        // Dimensiones del PDF (100x60mm)
        const pdfWidth = doc.internal.pageSize.getWidth(); // 100mm
        
        // Agregar texto (centrado)
        doc.setFontSize(14);
        doc.text(fullIdText, pdfWidth / 2, 8, { align: 'center' }); 
        
        // Agregar la imagen del código de barras. Ajustar las coordenadas (x, y, ancho, alto)
        // Usaremos 90mm de ancho para la imagen (de 100mm total) y centramos.
        const barcodeWidth = 90;
        const barcodeHeight = 30; // 30mm de alto
        const xPos = (pdfWidth - barcodeWidth) / 2; // (100 - 90) / 2 = 5mm
        
        doc.addImage(imgData, 'PNG', xPos, 15, barcodeWidth, barcodeHeight); 

        doc.save("etiqueta_expediente.pdf");
    };
    img.src = url;

});

// --- Lógica de Escaneo con Cámara (Manteniendo la funcionalidad original) ---
// NOTA: Esta sección no fue modificada, pero la mejora del scanner USB 
// hace que sea preferible usar el evento 'change' en los campos.

// Importante: La librería QuaggaJS y su CSS deben estar cargados si quieres usar la cámara.
// Asegúrate de que el modal de escaneo (#scanner-modal) tenga un estilo que no rompa la interfaz.

function startScan() {
    // Si la librería QuaggaJS está definida, se inicia el escaneo con la cámara
    if (typeof Quagga !== 'undefined') {
        // ... (Tu código original de initScanner, startScan, etc.)
        // Se mantiene la funcionalidad de cámara en el modal original si lo necesitas.
        
        // El código original aquí manejaba la cámara. Asumiendo que está en el app.js:
        const selectedDeviceId = cameraSelect.value;
        const constraints = {
            video: {
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined
            }
        };

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: scannerVideo,
                constraints: constraints
            },
            decoder: {
                readers: ["code_39_reader"]
            }
        }, function (err) {
            if (err) {
                scannerFeedback.textContent = 'Error al iniciar la cámara: ' + err.message;
                return;
            }
            Quagga.start();
        });

        Quagga.onDetected(function (result) {
            const code = result.codeResult.code;
            Quagga.stop();
            processBarcode(code, state.scannerMode);
            // La función processBarcode anterior ahora es processBarcodeForCarga para la pestaña de Carga
            // En el código original, si se usaba para la búsqueda, aquí iría otra lógica.
        });
    } else {
        // Mensaje de feedback si falta QuaggaJS
        scannerFeedback.textContent = 'ERROR: Falta QuaggaJS para escanear con cámara.';
    }
}

function processBarcode(code, mode) {
    const parts = code.split('-');
    const regex = /^\d+-\d+-(\d+)/; // Patrón simplificado de ejemplo
    
    if (parts.length === 4 && regex.test(code)) {
        if (mode === 'carga') {
            processBarcodeForCarga(code); // Usar la nueva función de llenado de campos de Carga
            closeAllModals();
        } else if (mode === 'busqueda') {
            // Llenar campos de búsqueda y buscar
            searchCodigo.value = parts[0];
            searchNumero.value = parts[1];
            searchLetra.value  = parts[2];
            searchAnio.value   = parts[3];
            performSearch();
            closeAllModals();
        }
    } else {
        scannerFeedback.textContent = 'Código no reconocido. Formato esperado: CODIGO-NUMERO-LETRA-AÑO';
        // Usar la función de feedback para evitar alert
        // alert('Código no reconocido. Formato esperado: CODIGO-NUMERO-LETRA-AÑO'); 
    }
}

function stopScanner() {
  try { state.scanner?.reset(); } catch(_) {}
  stopMediaTracks(scannerVideo);
  closeAllModals();
}

scanCargaBtn.addEventListener('click', () => {
    state.scannerMode = 'carga';
    openModal(scannerModal);
    startScan();
});
scanBusquedaBtn.addEventListener('click', () => {
    state.scannerMode = 'busqueda';
    openModal(scannerModal);
    startScan();
});
cameraSelect.addEventListener('change', startScan);

// --- Lógica de Modales ---
function openModal(modal) {
  modalOverlay.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function closeAllModals() {
  modalOverlay.classList.add('hidden');
  allModals.forEach(modal => modal.classList.add('hidden'));
  try { state.scanner?.reset(); } catch (_) {}
  if (scannerVideo) {
    try { stopMediaTracks(scannerVideo); } catch (_) {}
    scannerVideo.srcObject = null;
  }
}

settingsBtn.addEventListener('click', () => openModal(settingsModal));
advancedSearchBtn.addEventListener('click', () => openModal(advancedSearchModal));
// Cerrar modales al hacer clic en el overlay (opcional)
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        closeAllModals();
    }
});

$$('.close-modal-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    closeAllModals();
}));

// Manejador de Guardar Configuración (Apodo)
$('#save-settings-btn').addEventListener('click', () => {
    const newApodo = $('#user-apodo').value.trim();
    if (newApodo && state.currentUser) {
        state.userProfile.apodo = newApodo;
        // Guardar en Firestore (simulación)
        // db.collection('users').doc(state.currentUser.uid).set({ apodo: newApodo }, { merge: true });
        console.log(`Configuración guardada. Tu apodo es: ${newApodo}`);
    }
    closeAllModals();
});
