# BLESH

Tienda en Next.js para Perú (PEN), con solicitud de carrito y coordinación de pago/entrega por WhatsApp.

La arquitectura y el alcance están en el [índice de documentación](docs/README.md), el [SDD](docs/SDD.md) y los [ADRs](docs/adr/README.md). Las fases de desarrollo están en [docs/desarrollo-v1](docs/desarrollo-v1/README.md). El [prototipo](prototipo/) es la referencia visual.

## Estado

| Fase | Estado |
| --- | --- |
| 01 Base técnica | Hecha: `src/` modular, PostgreSQL + Drizzle, migraciones, reglas de dependencias, pruebas |
| 02 Gestión de acceso | Hecha en local: login, MFA TOTP obligatoria, recuperación, invitaciones, owner/operator, revocación, último owner, auditoría. Ver [operación de acceso](docs/acceso-administrativo.md) |
| 03 Productos y stock | Hecha en local: producto → colores → tallas (SKU/precio), fotos validadas en Storage, stock físico/reservado/disponible con ajustes auditados, publicación con requisitos. Categorías y guía de tallas por seed |
| 04–07 | Pendientes |

## Requisitos

- Node.js ≥ 20.19 y npm (`npm ci`).
- Docker (Docker Desktop en Windows) para PostgreSQL y Supabase local.

## Puesta en marcha local

```bash
npm ci
cp .env.example .env.local     # valores locales ficticios
npm run db:up                  # PostgreSQL 17 en 127.0.0.1:54329
npm run auth:up                # Supabase Auth local + buzón Mailpit (127.0.0.1:54324)
npx supabase status -o env     # copiar claves locales a .env.local (SUPABASE_*)
npm run db:migrate
npm run storage:setup          # bucket de imágenes «catalog» (idempotente)
npm run admin:bootstrap-owner -- --email tu@correo --name "Tu nombre"
npm run dev                    # abrir el enlace del correo en Mailpit
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint, incluidas las reglas de límites entre módulos |
| `npm run typecheck` | Tipos de rutas + `tsc --noEmit` |
| `npm test` | Unitarias, arquitectura y migraciones (PGlite); sin servicios externos |
| `npm run test:integration` | PostgreSQL real (base `blesh_test`) y Supabase Auth local |
| `npm run check` | lint + typecheck + test |
| `npm run db:up` / `db:down` | PostgreSQL local (Docker) |
| `npm run auth:up` / `auth:down` | Supabase local (Auth + Mailpit) |
| `npm run db:generate` / `db:migrate` | Generar / aplicar migraciones |
| `npm run db:check` | Conexión runtime y permisos mínimos |
| `npm run db:seed` | Datos ficticios; solo base local |
| `npm run admin:bootstrap-owner` | Alta controlada del primer propietario |
| `npm run admin:reset-mfa` | Restablecimiento MFA de emergencia (auditado) |
| `npm run storage:setup` | Crea/actualiza el bucket público de imágenes (WebP, 5 MB) |

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
  catalog/ media/ inventory/   misma estructura por capas
src/composition/     cruza módulos por ids (editor de producto, publicación)
src/infrastructure/  configuración validada, base de datos y cliente Supabase
src/shared/          dinero, fechas, formularios y UI de marca (sin negocio)
supabase/            configuración local y plantillas de correo
db/migrations/       SQL versionado
scripts/             operación (migrar, seed, accesos) y lanzador de Vitest
tests/               arquitectura e integración
```
