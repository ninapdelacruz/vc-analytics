# Despliegue Hostinger — Villa Campo Analytics

## Configuración en hPanel (Settings and redeploy)

| Campo | Valor |
|-------|--------|
| **Estructura / Framework** | Express |
| **Node.js** | **20.x** (no 22.x) |
| **Build command** | `npm run build` |
| **Start command** | `npm start` |
| **Entry file** | `dist/server.js` |
| **Output directory** | `dist` |

Todo (frontend + servidor) queda dentro de `dist/` tras el build.

## Variables de entorno

```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=u313974416_vc_analytics
MYSQL_PASSWORD=tu_contraseña
MYSQL_DATABASE=u313974416_vc_analytics
ACCESS_CODE=tu_codigo
SESSION_HOURS=8
CORS_ORIGIN=https://analisisacademico.ievillacampo10.edu.co
```

## Verificación

`https://analisisacademico.ievillacampo10.edu.co/api/health`

## Si el build termina OK pero marca "Falló la compilación"

1. Cambia Node de **22.x** a **20.x**
2. Entry file: `dist/server.js` (no `app.js`)
3. Output directory: `dist`
4. Revisa el log **después** de `[postbuild] OK` — ahí está el error de arranque
