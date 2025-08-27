# Tailwind Build (Producción)
Este proyecto viene listo para compilar Tailwind de forma local o en CI.

## Opción A: Build local
1. Instalar dependencias (una única vez):
   npm install
2. Compilar el CSS:
   npm run build
3. Esto generará `styles.tailwind.css` en la raíz del proyecto.
   - Luego, en `index.html`, reemplaza la línea de Twind por:
     <link rel="stylesheet" href="./styles.tailwind.css" />
   - (Opcional) Deja `styles.css` para tus estilos personalizados.

## Opción B: GitHub Actions
Puedes crear un workflow que ejecute `npm ci && npm run build` y publique
`styles.tailwind.css` junto al resto de archivos en GitHub Pages.


## Publicación automática (GitHub Pages)
Este repositorio incluye `.github/workflows/deploy.yml`.
Al hacer push a `main`/`master`:
- Compila `styles.tailwind.css`.
- Publica todo en GitHub Pages.

Si no usás Actions, podés correr `npm run build` localmente y subir `styles.tailwind.css` junto al resto.
