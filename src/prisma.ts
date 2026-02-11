import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const url = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '');
const pool = new Pool({
    connectionString: url,
    ssl: {
        rejectUnauthorized: false
    }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
