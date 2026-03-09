# SELF CHAT

PWA mobile-first para chatear solo contigo mismo, sincronizada en tiempo real entre dispositivos con Firebase.

## 1) Arquitectura completa

- **Frontend (Vite + React + TypeScript)**
  - UI tipo mensajeria: header, lista de mensajes, composer fijo abajo.
  - Estado desacoplado por hooks:
    - `useAuthUser`: escucha sesion Firebase Auth.
    - `useMessages`: suscripcion realtime, paginacion, envio de texto/archivos.
  - Render de mensajes por tipo: `text`, `link`, `image`, `file`.

- **Auth (Firebase Authentication)**
  - Login Google (`signInWithPopup`).
  - Login/registro email + password.
  - Al autenticar: `ensureUserProfile()` crea/actualiza `users/{uid}`.

- **DB (Cloud Firestore)**
  - Modelo estricto 1 usuario = 1 chat propio.
  - Coleccion por usuario:
    - `apps/control-chat/apps/control-chat/users/{userId}/messages/{messageId}`.
  - Realtime con `onSnapshot` sobre `createdAt`.

- **Storage (Firebase Storage)**
  - Archivos en:
    - `user-files/{userId}/{messageId}/{filename}`.
  - El `messageId` del documento coincide con la ruta de Storage (mejor trazabilidad).

- **PWA**
  - `vite-plugin-pwa` con manifest, service worker y cache runtime para archivos de Firebase Storage.
  - Firestore con cache persistente offline (`persistentLocalCache`).

- **Opcional API en Render (Node.js)**
  - No necesaria para MVP.
  - Recomendado solo para features avanzadas: OCR, thumbnails, enriquecimiento de links, tags inteligentes.

## 2) Estructura de carpetas

```text
controlChat/
  public/
    favicon.svg
    pwa-192.png
    pwa-512.png
    pwa-512-maskable.png
  src/
    components/
      AuthScreen.tsx
      ChatHeader.tsx
      ChatScreen.tsx
      Composer.tsx
      MessageBubble.tsx
      MessageList.tsx
    hooks/
      useAuthUser.ts
      useMessages.ts
    lib/
      auth.ts
      firebase.ts
      messages.ts
      types.ts
    styles/
      app.css
    App.tsx
    main.tsx
    vite-env.d.ts
  .env.example
  .firebaserc
  firebase.json
  firestore.rules
  storage.rules
  index.html
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
```

## 3) Reglas Firestore

Archivo: `firestore.rules`

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /apps/control-chat/users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /messages/{messageId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## 4) Componentes React

- `AuthScreen`: login Google + email/password.
- `ChatHeader`: avatar, nombre app, logout, buscador.
- `MessageList`: lista scrollable, agrupacion por fecha, cargar anteriores.
- `MessageBubble`: render por tipo + copiar texto.
- `Composer`: envio texto, adjuntos, caption opcional.
- `ChatScreen`: orquesta header/list/composer.
- `App`: controla sesion y drag & drop desktop.

## 5) Setup de Firebase

1. Crea proyecto en Firebase Console.
2. Activa:
   - Authentication: Google + Email/Password.
   - Firestore Database.
   - Storage.
3. Copia credenciales web a `.env` (basado en `.env.example`).
4. Configura proyecto CLI:
   - `firebase login`
   - `firebase use --add`
5. Publica reglas:
   - `firebase deploy --only firestore:rules,storage`

## 6) Setup PWA

- Manifest configurado en `vite.config.ts` (`VitePWA.manifest`).
- Service worker auto-update (`registerType: autoUpdate`).
- Cache offline:
  - Bundle estatico (`globPatterns`).
  - Recursos de Storage con estrategia `CacheFirst`.
- Firestore offline multi-tab habilitado con cache local persistente.

## 7) Layout UI (mobile-first)

- **Header sticky**
  - Avatar + SELF CHAT + logout.
  - Input de busqueda.
- **Chat body**
  - Burbujas estilo WhatsApp (alineadas a la derecha: mensajes propios).
  - Fecha por grupos.
  - Imagen preview y archivo con icono.
- **Composer sticky bottom**
  - Boton adjuntar.
  - Input principal.
  - Boton enviar grande (thumb-friendly).

## 8) Deploy

### Opcion A (recomendada): Firebase Hosting

```bash
npm install
npm run build
firebase deploy --only hosting
```

### Opcion B: Render (Static Site)

- Build command: `npm run build`
- Publish directory: `dist`
- Variables de entorno: `VITE_FIREBASE_*`

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Buenas practicas aplicadas

- Tipado fuerte en TypeScript.
- Arquitectura por capas (`components/hooks/lib`).
- Reglas de seguridad por `uid` en Firestore y Storage.
- Mobile-first real (composer fijo, targets tactiles >= 44px).
- PWA instalable + cache offline + sync realtime.
- Evita sistema multiusuario: solo datos de `request.auth.uid`.
