// /js/firebase-compat.js
// Requiere los SDK compat ya incluidos en index.html:
// firebase-app-compat.js, firebase-auth-compat.js, firebase-firestore-compat.js

(function () {
  if (typeof window.firebase === 'undefined') {
    throw new Error(
      'Firebase no está disponible. Asegurate de incluir los SDK compat en index.html ' +
      '(app-compat, auth-compat y firestore-compat) antes de este script.'
    );
  }

  // Configuración de Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyC_0rQspoBE3c6bU_to7g4pFX2uhVHLtH4",
    authDomain: "exptcoord.firebaseapp.com",
    projectId: "exptcoord",
    storageBucket: "exptcoord.firebasestorage.app",
    messagingSenderId: "416639039117",
    appId: "1:416639039117:web:d9422f6d853a760a3014c4",
    measurementId: "G-94PRRLFZV4"
  };

  // Inicializar solo una vez
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // Exponer globalmente
  window.auth = firebase.auth();
  window.db = firebase.firestore();
  window.Timestamp = firebase.firestore.Timestamp;

  console.log("Firebase inicializado correctamente desde firebase-compat.js");
})();
