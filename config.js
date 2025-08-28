// config.js
// Esta es la configuración de tu proyecto de Firebase.

export const firebaseConfig = {
  apiKey: "AIzaSyAHXCfXoJK1p_naZf5v0_cAa6cphX1e1E8",
  authDomain: "exptcoord.firebaseapp.com",
  projectId: "exptcoord",
  storageBucket: "exptcoord.appspot.com", // Corregí el dominio a .appspot.com, que es el más común.
  messagingSenderId: "416639039117",
  appId: "1:416639039117:web:d9422f6d853a760a3014c4",
};

// Inicializar Firebase (necesario para el script app.js corregido)
firebase.initializeApp(firebaseConfig);
