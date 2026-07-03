-- =============================================================================
-- Insertar / actualizar código de acceso: VillaCampo2026
-- Ejecutar en phpMyAdmin sobre u313974416_vc_analytics
-- =============================================================================

USE u313974416_vc_analytics;

INSERT INTO vc_codigo_acceso (id, codigo_hash, descripcion)
VALUES (
  1,
  LOWER(SHA2('VillaCampo2026', 256)),
  'Código institucional'
)
ON DUPLICATE KEY UPDATE
  codigo_hash = LOWER(SHA2('VillaCampo2026', 256)),
  descripcion = 'Código institucional';

-- Verificar que el hash quedó bien:
SELECT id, codigo_hash, descripcion FROM vc_codigo_acceso WHERE id = 1;
