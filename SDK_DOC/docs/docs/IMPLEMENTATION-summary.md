# Resumen de Implementación - API Contractual v1

**⚠️ INTERNAL – NOT PART OF THE CONTRACT**

Este documento es **SOLO para maintainers del SDK**. No es parte del contrato contractual y no debe ser usado por aplicaciones externas o IAs para entender las reglas contractuales.

**Para el contrato normativo, consulta:** [CONTRACT-folders.md](./CONTRACT-folders.md)

**Para guía de migración, consulta:** [MIGRATION-contractual-v1.md](./MIGRATION-contractual-v1.md)

---

## Objetivo

Agregar una nueva capa contractual al SDK que cumpla con el contrato App ↔ ControlFile v1, sin romper la compatibilidad con la API legacy existente.

**Nota:** Este documento describe detalles técnicos de implementación. No hace afirmaciones normativas. Las reglas contractuales están definidas exclusivamente en `CONTRACT-folders.md`.

## Archivos Creados

### 1. `src/modules/app-files/appRoot.ts`
- **Propósito:** Lógica para obtener/crear el app root
- **Características:**
  - Simula el app root usando una carpeta con nombre especial `__app_${appId}`
  - Funciones: `getOrCreateAppRoot()`, `getAppRootFolderName()`
  - Marcado como TRANSITIONAL (migrará a `POST /api/apps/:appId/root` cuando esté disponible)

### 2. `src/modules/app-files/ensurePathRelative.ts`
- **Propósito:** Asegurar paths relativos al app root
- **Características:**
  - **NUNCA** crea carpetas con `parentId = null`
  - Todos los paths son relativos al `appRootId` proporcionado
  - Función principal: `ensurePathRelative()`

### 3. `src/modules/app-files/index.ts`
- **Propósito:** Módulo principal de la API contractual
- **Clase:** `AppFilesModule`
- **Métodos:**
  - `initialize()`: Inicializa el app root
  - `listFiles(params)`: Lista archivos usando paths relativos
  - `ensurePath(params)`: Asegura paths relativos al app root
  - `uploadFile(params)`: Sube archivos usando paths relativos

## Archivos Modificados

### 1. `src/types.ts`
- **Agregados:**
  - `AppFilesContext`: Contexto de aplicación
  - `AppListFilesParams`: Parámetros para listar archivos (sin parentId)
  - `AppEnsurePathParams`: Parámetros para asegurar paths (sin parentId)
  - `AppUploadFileParams`: Parámetros para subir archivos (sin parentId)

### 2. `src/client.ts`
- **Agregado:**
  - Método `forApp(appId, userId)`: Devuelve `AppFilesModule` para operaciones contractuales

### 3. `src/modules/folders/index.ts`
- **Modificado:**
  - Marcado como `@deprecated` con comentarios JSDoc
  - Explicación de por qué es legacy y qué usar en su lugar

### 4. `src/modules/folders/ensurePath.ts`
- **Modificado:**
  - Marcado como legacy con comentarios explicativos

### 5. `src/modules/files.ts`
- **Modificado:**
  - Métodos `list()`, `upload()`, `uploadFile()` marcados como `@deprecated`
  - Comentarios JSDoc explicando por qué son legacy

### 6. `src/index.ts`
- **Agregados:**
  - Exports de tipos contractuales (`AppFilesContext`, `AppListFilesParams`, etc.)
  - Export de `AppFilesModule` (para uso interno)

## Documentación Creada

### 1. `src/docs/MIGRATION-contractual-v1.md`
- Guía completa de migración de API legacy a API contractual
- Ejemplos antes/después
- Mapeo de métodos
- Preguntas frecuentes

## Características de la Nueva API

**Nota técnica:** La implementación cumple con el contrato definido en `CONTRACT-folders.md`. Los detalles técnicos son:

1. **No expone parentId:**
   - Todos los métodos usan paths relativos
   - Los tipos públicos no incluyen `parentId`

2. **No permite crear carpetas raíz:**
   - `ensurePathRelative()` garantiza que `parentId` nunca es `null`
   - Todos los paths son relativos al app root

3. **Encapsula la jerarquía:**
   - Las apps no necesitan conocer `parentId`
   - El SDK resuelve automáticamente los paths

4. **No usa endpoints legacy directamente:**
   - Los métodos públicos no exponen `/api/folders/*`
   - La lógica interna usa endpoints legacy pero está encapsulada

### ⚠️ TRANSITIONAL

- El app root se simula usando una carpeta con nombre especial `__app_${appId}`
- Cuando el backend implemente `POST /api/apps/:appId/root`, solo se necesita actualizar `appRoot.ts`
- Las apps no necesitan cambiar su código

## Compatibilidad

- ✅ La API legacy sigue funcionando (no se rompe compatibilidad)
- ✅ Las apps pueden migrar gradualmente
- ⚠️ La API legacy está marcada como `@deprecated`

## Uso de la Nueva API

**Nota:** Este es un ejemplo técnico. Para documentación completa de uso, consulta el README del SDK.

```typescript
import { ControlFileClient } from '@controlfile/sdk';

const client = new ControlFileClient({ /* config */ });

// Obtener contexto de aplicación
const appFiles = client.forApp('controldoc', 'user_123');

// Listar archivos (path relativo al app root)
const files = await appFiles.listFiles({ path: ['documentos'] });

// Asegurar path (nunca crea carpetas raíz)
const folderId = await appFiles.ensurePath({ 
  path: ['documentos', 'aprobados'] 
});

// Subir archivo (path relativo al app root)
await appFiles.uploadFile({ 
  file: myFile,
  path: ['documentos', '2024'] 
});
```

## Próximos Pasos (Técnicos)

1. **Backend:** Implementar `POST /api/apps/:appId/root` (según contrato)
2. **SDK:** Migrar `appRoot.ts` para usar el nuevo endpoint
3. **Apps:** Migrar gradualmente a la nueva API (ver guía de migración)
4. **Futuro:** Deprecar y eventualmente remover la API legacy

**Nota:** Estos pasos son técnicos. Las reglas contractuales están en `CONTRACT-folders.md`.

## Notas Técnicas

- El app root se cachea en memoria (`appRootId` en `AppFilesModule`)
- La inicialización es lazy (se hace automáticamente en la primera operación)
- Todos los paths son arrays de strings (`string[]`)
- Los paths vacíos o `undefined` se interpretan como app root
