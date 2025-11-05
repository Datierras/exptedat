// /js/firebase-compat.js
// Usa Firebase compat que ya cargás desde index.html (global window.firebase)

if (typeof window.firebase === 'undefined') {
  throw new Error(
    'Firebase no está disponible. Asegurate de incluir en index.html ' +
    'los scripts compat: app-compat, auth-compat y firestore-compat antes de /js/*.js'
  );
}

// Tu config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "exptcoord.firebaseapp.com",
  projectId: "exptcoord",
  storageBucket: "exptcoord.firebasestorage.app",
  messagingSenderId: "416639039117",
  appId: "1:416639039117:web:d9422f6d853a760a3014c4",
  measurementId: "G-94PRRLFZV4"
};

// Inicializá solo una vez
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const Timestamp = firebase.firestore.Timestamp;

export { auth, db, Timestamp };
export default { auth, db, Timestamp };
