// /js/firebase-compat.js
// Inicializa Firebase usando el SDK compat v9 DESDE CDN y exporta auth, db y Timestamp

// Cargamos los módulos compat desde CDN (import ES Modules)
import "https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js";
import "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js";

// Config de tu proyecto (la tuya)
const firebaseConfig = {
  apiKey: "AIzaSyAHXCfXoJK1p_naZf5v0_cAa6cphX1e1E8",
  authDomain: "exptcoord.firebaseapp.com",
  projectId: "exptcoord",
  storageBucket: "exptcoord.firebasestorage.app",
  messagingSenderId: "416639039117",
  appId: "1:416639039117:web:d9422f6d853a760a3014c4",
  measurementId: "G-94PRRLFZV4"
};

// Evita doble init en HMR/recargas
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Exports con nombre que usa el resto de la app
const auth = firebase.auth();
const db = firebase.firestore();
const Timestamp = firebase.firestore.Timestamp;

export { auth, db, Timestamp };
// (opcional) export default por conveniencia
export default { auth, db, Timestamp };
