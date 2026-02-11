import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS Configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'https://gestion-riesgos-app.onrender.com',
    process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(null, true); // Allow anyway in production for now
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(morgan('dev'));

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
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({
        status,
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
});

export default app;
