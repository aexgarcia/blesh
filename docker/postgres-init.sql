-- Roles locales de desarrollo. Se ejecuta una sola vez al crear el volumen.
-- blesh_migrator: propietario del esquema, usado solo por migraciones.
-- blesh_app: usuario runtime; obtiene permisos solo mediante el rol de grupo blesh_runtime.
-- Las migraciones conceden privilegios a blesh_runtime, nunca a un usuario concreto.

CREATE ROLE blesh_migrator LOGIN PASSWORD 'blesh_migrator_local';
CREATE ROLE blesh_app LOGIN PASSWORD 'blesh_app_local';
CREATE ROLE blesh_runtime NOLOGIN;
GRANT blesh_runtime TO blesh_app;

GRANT CONNECT, CREATE ON DATABASE blesh TO blesh_migrator;
GRANT CONNECT ON DATABASE blesh TO blesh_app;

-- PostgreSQL 15+ ya no concede CREATE en public; se refuerza explícitamente.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Base aislada para pruebas de integración (npm run test:integration).
CREATE DATABASE blesh_test OWNER blesh_migrator;
GRANT CONNECT ON DATABASE blesh_test TO blesh_app;
