# Seguridad del backend

## JWT (JSON Web Token)

- **Login** (`POST /api/auth/login`): Si las credenciales son correctas, el servidor devuelve un `token` JWT y los datos del usuario. El frontend debe guardar el token (por ejemplo en `sessionStorage`) y enviarlo en cada petición con el header `Authorization: Bearer <token>`.
- **getMe** (`GET /api/auth/me`): Acepta el token en `Authorization` y opcionalmente `id` en query; si viene token, se usa para identificar al usuario.

### Variables de entorno

| Variable       | Descripción                          | Ejemplo / valor por defecto |
|----------------|--------------------------------------|-----------------------------|
| `JWT_SECRET`   | Clave secreta para firmar el JWT. En producción usar una cadena larga y aleatoria (mín. 32 caracteres). | `default-secret-cambiar-en-produccion` |
| `JWT_EXPIRES_IN` | Tiempo de vida del token.           | `7d` (7 días)               |

En producción **debe** definirse `JWT_SECRET` con un valor seguro (por ejemplo generado con `openssl rand -base64 32`).

## Contraseñas

- Las contraseñas se almacenan **en texto plano** en la base de datos (según requisito del proyecto).
- En **login** se compara la contraseña enviada con la guardada en BD.
- Al **crear** o **actualizar** usuario, la contraseña se guarda tal cual (sin hash).

## Auth obligatoria en rutas sensibles

- El middleware de autenticación está aplicado con **auth obligatoria** en todas las rutas bajo `/api`, **excepto**:
  - `GET /api/health` (chequeo de estado)
  - `POST /api/auth/login` (inicio de sesión)
- Cualquier otra petición a `/api/*` debe incluir el header `Authorization: Bearer <token>` con un JWT válido. Si no se envía token o es inválido/expirado, el servidor responde **401 No autorizado**.
- Con token válido se asigna `req.user` (userId, email, role) para uso en controladores.

## HTTPS

En producción se debe usar **HTTPS** para que el token y los datos no viajen en claro.
