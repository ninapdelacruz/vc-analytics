# Configuración de despliegue — Hostinger Node.js

> Hostinger auto-detecta **Vite** y trata la app como sitio estático.
> Debes cambiar el framework a **Express.js** para que arranque el servidor API.

## hPanel → Settings and redeploy

| Campo | Valor |
|-------|--------|
| **Framework** | **Express.js** (no Vite) |
| **Node.js version** | 20.x |
| **Install command** | `npm install` |
| **Build command** | `npm run build` |
| **Start command** | `npm start` |
| **Entry file** | `app.js` |
| **Output directory** | `dist` |

## Variables de entorno

```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=u313974416_vc_analytics
MYSQL_PASSWORD=tu_contraseña
MYSQL_DATABASE=u313974416_vc_analytics
ACCESS_CODE=tu_codigo_secreto
SESSION_HOURS=8
CORS_ORIGIN=https://analisisacademico.ievillacampo10.edu.co
```

No definas `PORT` manualmente: Hostinger la asigna sola.

## Verificación post-deploy

1. `https://analisisacademico.ievillacampo10.edu.co/api/health`
2. Debe responder: `{"ok":true,"mysql":true,"codigoConfigurado":true}`

## Si el build termina OK pero falla el deploy

Revisa el log **después** de `build:server` — ahí aparece el error de arranque.
Causa habitual: framework en **Vite** en lugar de **Express.js**.
