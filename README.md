# Villa Campo Analytics

Dashboard académico institucional (React + Express + MySQL).

## Desarrollo local

```bash
npm install
cp .env.example .env   # editar credenciales MySQL y ACCESS_CODE
mysql -u root -p < database/schema.sql   # o importar en phpMyAdmin
npm run server   # terminal 1 — API puerto 3001
npm run dev      # terminal 2 — frontend puerto 3000
```

## Despliegue en Hostinger (Node.js)

### 1. Variables de entorno (hPanel)

| Variable | Valor |
|----------|--------|
| `MYSQL_HOST` | `localhost` |
| `MYSQL_PORT` | `3306` |
| `MYSQL_USER` | `u313974416_vc_analytics` |
| `MYSQL_PASSWORD` | *(tu contraseña)* |
| `MYSQL_DATABASE` | `u313974416_vc_analytics` |
| `ACCESS_CODE` | *(código institucional)* |
| `SESSION_HOURS` | `8` |
| `CORS_ORIGIN` | `https://analisisacademico.ievillacampo10.edu.co` |

No hace falta definir `PORT`: Hostinger la asigna automáticamente.

### 2. Base de datos

Importar `database/schema.sql` en phpMyAdmin sobre la BD `u313974416_vc_analytics`.

### 3. Comandos en el panel Node.js de Hostinger

| Campo | Valor |
|-------|--------|
| **Build command** | `npm install && npm run build` |
| **Start command** | `npm start` |
| **Node version** | 20 o superior |
| **Application root** | raíz del repositorio |

### 4. Verificar

- `https://tudominio.com/api/health` → debe responder `{ "ok": true, "mysql": true }`
- Abrir la app y probar acceso a Administración con `ACCESS_CODE`

### Notas

- El build compila el frontend (`dist/`) y el servidor (`dist-server/index.js`).
- `npm start` usa Node puro (no requiere `tsx` en producción).
- Los avisos `deprecated` y `dynamic import` del build son normales y no impiden el despliegue.
