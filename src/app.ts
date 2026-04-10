import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { authMiddleware } from './middleware/auth';
import { auditMiddleware } from './middleware/audit.middleware';
import routes from './routes';

const app = express();

// OPTIMIZADO: Comprimir todas las respuestas HTTP (gzip)
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Nivel de compresión (0-9, 6 es el default y buen balance)
  }),
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://gestion-riesgos-app.onrender.com',
  'https://erm.comware.com.ec',
  'https://api-erm.comware.com.ec',
  // Frontend productivo desde variable de entorno
  process.env.CORS_ORIGIN,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // En caso de origen no permitido, devolver error explícito
      return callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Enhanced Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for React in dev
        imgSrc: ["'self'", 'data:', 'https:'],
        // Permite conexiones desde el frontend y hacia la API
        connectSrc: [
          "'self'",
          process.env.CORS_ORIGIN || 'http://localhost:5173',
          'https://api-erm.comware.com.ec',
          'https://erm.comware.com.ec',
        ],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow external resources
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// Rate limiting headers (basic)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// JWT obligatorio en todas las rutas /api salvo health y POST auth/login
app.use(authMiddleware({ required: true, publicPaths: ['/api/health', '/api/auth/login'] }));

// Middleware de auditoría (captura automática de cambios)
app.use(auditMiddleware());

// Main Router
app.use('/api', routes);

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        status: 404,
        message: `Route ${req.originalUrl} not found`,
    });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Multer: archivo demasiado grande (el cliente puede mostrar mensaje claro)
    if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error:
                'El archivo supera el tamaño máximo permitido (25 MB). Comprima el PDF o use un archivo más liviano.',
            code: 'FILE_TOO_LARGE',
        });
    }
    if (
        typeof err?.message === 'string' &&
        err.message.includes('Tipo de archivo no permitido')
    ) {
        return res.status(400).json({
            error: err.message,
            code: 'INVALID_FILE_TYPE',
        });
    }
    const status = err.status || 500;
    res.status(status).json({
        status,
        error: err.message || 'Internal Server Error',
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
});

export default app;
