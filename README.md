# BLESH

Tienda en Next.js para Perú (PEN), con solicitud de carrito y coordinación de pago/entrega por WhatsApp.

La arquitectura y el alcance están en el [índice de documentación](docs/README.md), el [SDD](docs/SDD.md) y los [ADRs](docs/adr/README.md). Las fases de desarrollo están en [docs/desarrollo-v1](docs/desarrollo-v1/README.md). El [prototipo](prototipo/) es la referencia visual.

## Estado

| Fase | Estado |
| --- | --- |
| 01 Base técnica | Hecha: `src/` modular, PostgreSQL + Drizzle, migraciones, reglas de dependencias, pruebas |
| 02 Gestión de acceso | Hecha en local: login, MFA TOTP obligatoria, recuperación, invitaciones, owner/operator, revocación, último owner, auditoría. Ver [operación de acceso](docs/acceso-administrativo.md) |
| 03 Productos y stock | Hecha en local: producto → colores → tallas (SKU/precio), fotos validadas en Storage, stock físico/reservado/disponible con ajustes auditados, publicación con requisitos. Categorías y guías de tallas administrables |
| 04 Clientes | Hecha en local: directorio con búsqueda (nombre, teléfono, correo), alta idempotente, edición con versión, teléfono compartido con confirmación, archivado por owner con motivo. Historial de pedidos con la fase 5 |
| 05 Pedidos y cobros | Hecha en local: pedido manual WhatsApp/presencial cotizado en servidor, revisiones y acuerdo, confirmación con ficha y reserva atómica, abonos por modalidad (anticipado/adelanto/contraentrega, cobro de tercero por conciliar), preparación, despacho/recojo, entrega, cancelación, devoluciones de dinero y de prendas |
| 06 Tienda y WhatsApp | Hecha en local: inicio, catálogo y categorías por color, ficha con talla y galería, carrito local, cotización en servidor con diferencias a aceptar, solicitud idempotente con límite de tasa, mensaje completo de WhatsApp y recuperación local. Número y condiciones de prueba (sin solicitudes en producción hasta datos reales). Portada y ficha fieles al prototipo (contenido estático versionado, recursos en almacenamiento propio) y pack Boxy Essential calculado en servidor. Ver [ADR-019](docs/adr/019-tienda-publica-y-solicitud-whatsapp-v1.md) y [ADR-020](docs/adr/020-portada-del-prototipo-y-pack-boxy-essential.md) |
| 07 SEO y producción | Implementada y verificada en local: metadata/canonical/OG por color, sitemap completo, robots por entorno y JSON-LD; adaptador GA4 con consentimiento y activación explícita (apagado), cabeceras/CSP y errores seguros. Ensayo de restauración de BD local; Auth/Storage y lanzamiento aún pendientes. Ver [ADR-021](docs/adr/021-seo-analitica-y-preparacion-produccion.md) y [preparación de producción](docs/preparacion-produccion.md) |

## Requisitos

- Node.js ≥ 20.19 y npm (`npm ci`).
- Docker (Docker Desktop en Windows) para PostgreSQL y Supabase local.

## Puesta en marcha local

```bash
npm ci
cp .env.example .env.local     # valores locales ficticios
npm run db:up                  # PostgreSQL 17 en 127.0.0.1:54329
npm run auth:up                # Supabase Auth local (correos por Gmail: ver supabase/config.toml)
npx supabase status -o env     # copiar claves locales a .env.local (SUPABASE_*)
npm run db:migrate
npm run storage:setup          # bucket de imágenes «catalog» (idempotente)
# opcional: WHATSAPP_NUMBER=<número de PRUEBA> en .env.local para probar solicitudes
npm run prototype:import       # opcional, solo local: fotos/videos de portada + productos del prototipo
npm run admin:bootstrap-owner -- --email tu@correo --name "Tu nombre"
npm run dev                    # abrir el enlace del correo recibido en tu bandeja
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js (el build prerenderiza la tienda: requiere la base accesible) |
| `npm run lint` | ESLint, incluidas las reglas de límites entre módulos |
| `npm run typecheck` | Tipos de rutas + `tsc --noEmit` |
| `npm test` | Unitarias, arquitectura y migraciones (PGlite); sin servicios externos |
| `npm run test:integration` | PostgreSQL real (base `blesh_test`) y Supabase Auth local |
| `npm run check` | lint + typecheck + test |
| `npm run db:up` / `db:down` | PostgreSQL local (Docker) |
| `npm run auth:up` / `auth:down` | Supabase local (Auth; correos por Gmail) |
| `npm run db:generate` / `db:migrate` | Generar / aplicar migraciones |
| `npm run db:check` | Conexión runtime y permisos mínimos |
| `npm run db:seed` | Datos ficticios; solo base local |
| `npm run admin:bootstrap-owner` | Alta controlada del primer propietario |
| `npm run admin:reset-mfa` | Restablecimiento MFA de emergencia (auditado) |
| `npm run storage:setup` | Crea/actualiza los buckets públicos `catalog` (WebP, 5 MB) y `content` (WebP/MP4, 20 MB) |
| `npm run prototype:import` | Solo local: sube los recursos de portada del prototipo y crea sus productos con stock ficticio |
| `npm run backup:verify-local` | Ensayo de pg_dump/restore en copia efímera de blesh local; valida tablas/recuentos/balances; no incluye Auth/Storage ni backup externo |

## Configuración de la tienda

En **Administración → Tienda** (`/admin/tienda`), el propietario puede configurar:

La entrada de Tienda muestra un índice de accesos. Cada sección tiene su propia página: `general`, `portada`, `colecciones`, `pack`, `movimiento` y `biblioteca`, bajo `/admin/tienda/`. En escritorio se accede desde el submenú desplegable; en móvil, desde el selector de sección. Solo se muestra el formulario de la sección elegida, con guardado independiente. La biblioteca incluye subida y consulta de archivos.

- **Configuración general:** WhatsApp de pedidos y de atención, correo, Instagram/TikTok y datos públicos del negocio (nombre comercial, razón social/RUC opcionales, ubicación, dirección y horario). El botón flotante usa el número de atención y solo aparece en la página principal; se puede ocultar. Los campos de contacto vacíos no se publican. `WHATSAPP_NUMBER` conserva el valor inicial hasta el primer guardado; después manda el panel, incluso al dejar pedidos vacío para deshabilitarlos. El destino de cada solicitud se consulta de nuevo en servidor al enviarla. Migración `0015`; ver [ADR-026](docs/adr/026-configuracion-general-y-whatsapp-flotante.md).

- **Portada:** visibilidad, imagen propia o fondo de marca, descripción de imagen, título, texto superior, botón con destino interno y detalles inferiores.
- **Colecciones:** visibilidad, título/texto de sección, hasta 8 tarjetas con imagen, descripción, texto y destino; añadir, quitar y ordenar. Permanecen debajo de Todas las prendas. Las tarjetas con destinos retirados se ocultan; la portada usa `/productos` si su destino deja de estar disponible.
- **Arma tu pack:** título/texto, visibilidad, nombre de promoción, hasta 12 productos publicados y precios totales por 1/2/3 prendas. Ocultar el bloque y desactivar la promoción son controles distintos. Los cambios generan una nueva versión y conservan los importes/nombres de pedidos anteriores.
- **En movimiento:** visibilidad, textos, cuenta/enlace social, hasta 8 videos con orden, producto enlazado y portada. Biblioteca propia: MP4 y portadas hasta 5 MB por archivo; las imágenes se normalizan a WebP. No se descarga contenido desde URLs externas.

Solo el propietario guarda o sube archivos; cada guardado comprueba versión e idempotencia y deja auditoría. La configuración del pack y su bloque se guardan en una sola transacción. Migraciones `0009`/`0010`; ejecutar `npm run db:migrate` antes de usar la nueva pantalla. Ver [ADR-022](docs/adr/022-secciones-administrables-y-pack-configurable.md).

La biblioteca se comparte entre portada, colecciones y videos, con selección de archivos propios existentes y subida de imágenes normalizadas a WebP. Los cambios conservan validación de permisos, versión, reintentos y auditoría. Aplicar migración `0014` antes de usar categorías/portada/colecciones. Ver [ADR-025](docs/adr/025-categorias-portada-y-colecciones.md).

Las políticas y el resto del contenido siguen versionados en código, sin activación automática de condiciones no confirmadas. Configurar WhatsApp no elimina el requisito de condiciones finales para habilitar solicitudes en producción.

La guía de tallas incluye una calculadora por altura y peso que sugiere una talla aproximada (S, M o L) y permite aplicarla a las prendas seleccionadas con disponibilidad. La tabla de medidas de cada producto se muestra como referencia. Recordar talla es opcional y local; no se guardan altura ni peso. Los hoodies sin guía quedan en preparación hasta recibir sus medidas reales. Ver [ADR-023](docs/adr/023-calculadora-de-talla.md).

## Categorías, guías de tallas y URLs

En **Administración → Categorías** (`/admin/categorias`), propietario y operador pueden crear y editar nombre, descripción, orden y estado activo. La URL se sugiere al escribir y queda fija al crear. Desactivar oculta la categoría y sus enlaces; los productos publicados siguen en el catálogo general. La navegación y el pie muestran categorías activas con prendas publicadas y colores/tallas activos. Se conserva el inventario y no se borran categorías.

En **Administración → Guías de tallas** (`/admin/guias-de-tallas`), propietario y operador pueden crear y editar guías con tallas, largo y ancho reales en centímetros (un decimal, coma o punto). El editor muestra los productos que comparten la guía; guardar actualiza sus fichas y la calculadora. Para prendas con otras medidas, crear una guía distinta. No se asignan medidas a hoodies pendientes.

El formulario de producto permite crear y seleccionar una guía sin perder el borrador. La URL se deriva del título al escribir; personalizarla detiene la sugerencia y “Usar URL sugerida” la restablece. Las URLs de productos ya publicados siguen fijas.

Aplicar las migraciones `0011`–`0013` con `npm run db:migrate` antes de utilizar estas pantallas. Incluyen claves de reintento y permisos de escritura limitados, conservando el bloqueo de borrado de guías. Ver [ADR-024](docs/adr/024-administracion-de-guias-de-tallas.md).

## SEO, analítica y lanzamiento

- APP_URL fija el origen canónico; APP_ENV=production exige HTTPS. VERCEL_ENV=preview bloquea indexación y GA. Fuera de producción: noindex, robots bloqueado y sitemap vacío.
- GA4 requiere ID válido en NEXT_PUBLIC_GA_MEASUREMENT_ID y ANALYTICS_ENABLED=true, además de consentimiento del visitante. Sin configuración no hay etiqueta ni banner. ANALYTICS_QA=true permite solo QA local explícito; normalmente false.
- Antes de habilitar GA, configurar propiedad sin medición mejorada/formularios/outbound y sin Signals/publicidad; probar red/DebugView. Las pruebas locales con Google interceptado no son validación de una cuenta real.
- Producción sigue pendiente de hosting permitido, datos reales, condiciones finales, número oficial y recuperación completa. No usar stock ficticio del prototipo ni artefactos de QA como producción.
- La CSP mantiene unsafe-inline para el prerender actual y no es una política estricta con nonce; detalle y límites en ADR-021. Revisar reglas de proxy si se cambia Vercel por otro hosting.
- La metadata se resuelve antes de transmitir HTML para responder 404 también en la primera visita a productos/categorías inexistentes. Se mantienen Cache Components y Partial Prefetching; revisar el tiempo de respuesta de listados dinámicos antes de lanzar.

## Base de datos

- Tablas en el esquema privado `app`; control de migraciones en `drizzle`.
- `MIGRATION_DATABASE_URL` (propietario del esquema, solo migraciones) y `DATABASE_URL` (runtime, miembro de `blesh_runtime`). En cada entorno: `GRANT blesh_runtime TO <usuario_runtime>`.
- Con el pooler de Supabase en modo transacción: `DATABASE_PREPARE=false`.
- Instancias Drizzle solo con `createDrizzle()` (fija `casing: snake_case`).

## Estructura

```text
src/app/             rutas: (storefront), (auth)/admin/*, (backoffice)/admin/*
src/proxy.ts         refresco de sesión y 307 en /admin (optimista)
src/modules/         módulos de negocio; entre módulos solo contracts.ts o server.ts
  identity/          domain · application · infrastructure · presentation
  catalog/ media/ inventory/ customers/ sales/ content/   misma estructura por capas
src/composition/     cruza módulos por ids (editor de producto, publicación, ficha de cliente, pedido, tienda pública)
src/infrastructure/  configuración validada, base de datos, límite de tasa y cliente Supabase
src/shared/          dinero, fechas, formularios, UI de marca y eventos de analítica (sin negocio)
supabase/            configuración local y plantillas de correo
db/migrations/       SQL versionado
scripts/             operación (migrar, seed, accesos) y lanzador de Vitest
tests/unit/          unitarias, mismas carpetas que src/; sin tests junto al código
tests/               también arquitectura, integración y soporte
```
