import app from './app';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

const port = process.env.PORT || 8080;

const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
