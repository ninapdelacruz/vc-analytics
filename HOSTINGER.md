# Hostinger — Villa Campo Analytics

## Configuración en hPanel (debe coincidir exactamente)

| Campo | Valor |
|-------|--------|
| **Framework** | Express |
| **Node.js** | 22.x (o 20.x) |
| **Build command** | `npm run build` |
| **Start command** | `npm start` |
| **Entry file** | `server.js` |
| **Output directory** | `dist` |

> Hostinger arranca **`server.js` en la raíz** del proyecto (no `dist/server.js`).
> El build genera `server.js` + carpeta `dist/` con el frontend.

## Variables de entorno

Ver `.env.example` — MYSQL_*, ACCESS_CODE, CORS_ORIGIN.

## Verificación

`https://analisisacademico.ievillacampo10.edu.co/api/health`
