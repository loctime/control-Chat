# 📜 ControlFile – App Integration Contract (v1)

**DOCUMENTO NORMATIVO CANÓNICO**

Este es el único documento contractual oficial que define las reglas, límites y autoridad entre ControlFile y las aplicaciones externas. Todas las implementaciones del SDK y las aplicaciones deben cumplir con este contrato.

---

## 1. Principio de Autoridad

**ControlFile es la única autoridad sobre:**

- Estructura visible (navbar / taskbar)
- Reglas de UX
- Jerarquía permitida

**Las aplicaciones externas son clientes, no co-dueñas del filesystem.**

---

## 2. Conceptos Fundamentales

### 2.1 Jerarquía de Carpetas

La jerarquía se define exclusivamente por `parentId`:

- `parentId = null` → carpeta raíz (solo ControlFile UI puede crear)
- `parentId = <id>` → subcarpeta

**⚠️ IMPORTANTE: Jerarquía ≠ UX**

La jerarquía técnica (`parentId`) no determina la visibilidad en navbar o taskbar. Esos aspectos son controlados exclusivamente por ControlFile.

### 2.2 Navbar

**Definición:**
- Representa carpetas creadas manualmente por el usuario
- Es exploratorio
- Es exclusivo de ControlFile UI

**Regla contractual:**
- ❌ **Las apps NO pueden crear carpetas en el navbar**

### 2.3 Taskbar

**Definición:**
- Representa accesos rápidos de aplicaciones
- No depende de `parentId`
- No depende de `metadata.source`
- Se define únicamente por `userSettings.taskbarItems`

**Regla contractual:**
- Solo ControlFile puede modificar el taskbar mediante la Taskbar API

---

## 3. Reglas Duras (Obligatorias)

### 3.1 Creación de Carpetas por Apps

**❌ PROHIBIDO para apps:**

1. Crear carpetas con `parentId = null` (carpetas raíz)
2. Crear carpetas visibles en navbar
3. Auto-pinnear carpetas al taskbar
4. Exponer `parentId` en APIs públicas
5. Usar endpoints legacy directamente (`/api/folders/*`) para crear carpetas raíz

**✅ PERMITIDO para apps:**

1. Solicitar su carpeta raíz de aplicación mediante API dedicada (`POST /api/apps/:appId/root`)
2. Crear subcarpetas dentro de su app root usando paths relativos
3. Usar el SDK contractual que encapsula la jerarquía

### 3.2 ControlFile UI

**Permisos exclusivos:**

- Puede crear carpetas raíz (`parentId = null`)
- Esas carpetas aparecen en navbar
- No se auto-agregan al taskbar (requiere acción explícita del usuario)

---

## 4. APIs Contractuales (Oficiales)

### 4.1 App Root API (Obligatorio para Apps)

**Endpoint:** `POST /api/apps/:appId/root`

**Responsabilidad de ControlFile:**

1. Crear (o reutilizar) carpeta raíz de la app
2. **NO** exponerla en navbar
3. **SÍ** agregarla al taskbar automáticamente
4. Operación idempotente (múltiples llamadas devuelven el mismo resultado)

**Responsabilidad de Apps:**

- Las apps **NO** eligen `parentId`
- Las apps **NO** controlan la UX
- Las apps deben usar este endpoint para obtener su app root antes de cualquier operación

### 4.2 Taskbar API (Explícita)

**Endpoints:**
- `GET /api/taskbar` - Listar items del taskbar
- `POST /api/taskbar/pin` - Agregar item al taskbar
- `POST /api/taskbar/unpin` - Remover item del taskbar

**Reglas:**

- Operan solo sobre `userSettings.taskbarItems`
- No crean carpetas
- No modifican jerarquía
- ControlFile puede usar esta API para gestionar el taskbar

---

## 5. SDK Contractual (Interfaz Mínima)

Las apps **NO** crean carpetas directamente. Usan el SDK contractual:

```typescript
const appFiles = client.forApp('controldoc', 'user_123');
await appFiles.ensurePath({ path: ['documentos', 'aprobados'] });
```

**ControlFile garantiza:**

1. Existencia de la carpeta
2. Ubicación correcta (relativa al app root)
3. Coherencia UX (no aparece en navbar)
4. Encapsulación completa (no expone `parentId`)

**Reglas del SDK:**

- Todos los paths son relativos al app root
- `path: []` o `path: undefined` = app root
- `path: ['documentos']` = `appRoot/documentos`
- El SDK **NUNCA** crea carpetas con `parentId = null`

---

## 6. metadata.source (Estado v1)

**Estado actual:**

- `metadata.source` **NO** tiene valor contractual
- **NO** define UX
- **NO** define jerarquía
- **NO** debe ser usado por apps

**Futuro:**

- Se elimina o se redefine en v2
- Las apps no deben depender de este campo

---

## 7. Compatibilidad y Transición

### Estado Actual

Hasta que este contrato se implemente completamente:

- El backend puede seguir siendo permisivo técnicamente
- **PERO** la documentación deja claro que:
  - Crear carpetas raíz desde apps es **comportamiento no soportado**
  - Cualquier app que lo haga está **fuera de contrato**

### Migración

- Las apps deben migrar gradualmente a la API contractual
- La API legacy está marcada como `@deprecated`
- Ver [MIGRATION-contractual-v1.md](./MIGRATION-contractual-v1.md) para guía de migración

---

## 8. Beneficios del Contrato

1. **Navbar limpio** - Solo carpetas creadas por usuarios
2. **Taskbar predecible** - Solo apps registradas
3. **SDK simple** - Paths relativos, sin `parentId`
4. **UX consistente** - ControlFile controla la experiencia
5. **Plataforma gobernada** - No anárquica, con reglas claras

---

## 9. Violaciones del Contrato

**Una app está fuera de contrato si:**

1. Crea carpetas con `parentId = null` directamente
2. Expone `parentId` en su API pública
3. Usa endpoints legacy (`/api/folders/*`) para crear carpetas raíz
4. Intenta modificar el navbar o taskbar directamente
5. Depende de `metadata.source` para lógica de negocio

**Consecuencias:**

- Comportamiento no garantizado
- Puede romper con futuras versiones del SDK
- No recibe soporte oficial

---

## Referencias

- [Guía de Migración](./MIGRATION-contractual-v1.md) - Pasos prácticos para migrar a la API contractual
- [Documentación del SDK](../../README.md) - Uso del SDK