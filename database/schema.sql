-- =============================================================================
-- Villa Campo Analytics — Esquema MySQL 8.0+
-- =============================================================================
-- Hosting Hostinger:
--   1. Crear la BD u313974416_vc_analytics en hPanel (si no existe).
--   2. Abrir phpMyAdmin → seleccionar esa BD → Importar este archivo.
--
-- Acceso restringido (sin usuarios/roles): un único código institucional
-- protege Administración, Configuración y Calidad de datos.
-- =============================================================================

USE u313974416_vc_analytics;

-- -----------------------------------------------------------------------------
-- Código de acceso a módulos restringidos (una sola fila, id = 1)
-- codigo_hash = SHA2(codigo_en_texto_plano, 256) en hexadecimal minúsculas
-- El servidor puede inicializarlo desde la variable de entorno ACCESS_CODE.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vc_codigo_acceso (
  id              TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  codigo_hash     CHAR(64) NOT NULL COMMENT 'SHA-256 del código institucional',
  descripcion     VARCHAR(255) NULL,
  actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_vc_codigo_acceso_single CHECK (id = 1)
) ENGINE=InnoDB;

-- Para establecer el código manualmente en MySQL:
-- INSERT INTO vc_codigo_acceso (id, codigo_hash, descripcion)
-- VALUES (1, LOWER(SHA2('SU_CODIGO_SECRETO', 256)), 'Código institucional')
-- ON DUPLICATE KEY UPDATE codigo_hash = VALUES(codigo_hash), descripcion = VALUES(descripcion);

-- -----------------------------------------------------------------------------
-- Sesiones temporarias tras validar el código (sin cuentas de usuario)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vc_sesion_acceso (
  token       CHAR(36) NOT NULL PRIMARY KEY COMMENT 'UUID v4',
  expira_en   DATETIME NOT NULL,
  ip_origen   VARCHAR(45) NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vc_sesion_expira (expira_en)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Registro de intentos de acceso (auditoría ligera)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vc_acceso_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  modulo      VARCHAR(50) NOT NULL COMMENT 'admin | config | calidad',
  exito       TINYINT(1) NOT NULL,
  ip_origen   VARCHAR(45) NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vc_acceso_log_fecha (creado_en)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Configuración académica (JSON) — sincronización opcional con el panel Config
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vc_configuracion_academica (
  id              TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  json_config     JSON NOT NULL,
  actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_vc_config_single CHECK (id = 1)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Estado analítico institucional (snapshot JSON por año escolar)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vc_estado_analitico (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  anio_escolar    SMALLINT UNSIGNED NOT NULL,
  periodo_activo  VARCHAR(10) NOT NULL DEFAULT 'P1',
  calificaciones  JSON NOT NULL,
  alertas         JSON NULL,
  archivos_meta   JSON NULL COMMENT 'Metadatos de archivos Excel cargados',
  actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_vc_estado_anio (anio_escolar)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Metadatos de archivos Excel importados
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vc_archivo_carga (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre_archivo  VARCHAR(255) NOT NULL,
  anio_escolar    SMALLINT UNSIGNED NOT NULL,
  periodo         VARCHAR(10) NOT NULL,
  curso           VARCHAR(20) NULL,
  registros       INT UNSIGNED NOT NULL DEFAULT 0,
  cargado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vc_archivo_anio (anio_escolar, periodo)
) ENGINE=InnoDB;
