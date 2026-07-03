# Hostinger — Villa Campo Analytics

## Diagnóstico rápido

Abre en el navegador:

`https://analisisacademico.ievillacampo10.edu.co/api/health`

| Resultado | Significado |
|-----------|-------------|
| JSON con `"api": true` | Express está activo |
| Página HTML / error | Node no está corriendo; la API no existe |
| `"mysql": false` | Auth usa `ACCESS_CODE` en memoria (sigue funcionando) |

## Configuración en hPanel

| Campo | Valor |
|-------|--------|
| **Framework** | Express |
| **Node.js** | 22.x |
| **Build command** | `npm run build` |
| **Start command** | `npm start` |
| **Entry file** | `server.js` |
| **Output directory** | `dist` |

Si Hostinger solo despliega `dist/`, el entry también puede ser `server.js` **dentro** de `dist` (el build genera `dist/server.js` y lo copia a la raíz).

## Variables de entorno

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=u313974416_vc_analytics
MYSQL_PASSWORD=VCAnalytics1
MYSQL_DATABASE=u313974416_vc_analytics
ACCESS_CODE=VillaCampo2026
SESSION_HOURS=8
CORS_ORIGIN=https://analisisacademico.ievillacampo10.edu.co
```

El código de ingreso es el valor de **ACCESS_CODE** (`VillaCampo2026`).

Si MySQL falla, el servidor valida igual contra `ACCESS_CODE` (modo fallback).

## Tras cambiar variables

Dashboard → **Restart** (o Guardar y reimplementar).
