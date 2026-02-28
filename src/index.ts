import app from './app';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

const port = process.env.PORT || 8080;

const server = http.createServer(app);

server.listen(port, () => {});

process.on('SIGTERM', () => {
    server.close(() => {});
});
