import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const url = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '')
const pool = new Pool({
    connectionString: url,
    ssl: {
        rejectUnauthorized: false
    }
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('Starting seed debug...')
    try {
        const count = await prisma.cargo.count()
        console.log('Current cargo count:', count)

        console.log('Upserting one cargo...')
        await prisma.cargo.upsert({
            where: { nombre: 'Director General' },
            update: {},
            create: { nombre: 'Director General' }
        })
        console.log('Upsert done.')
    } catch (e) {
        console.error('Error:', e)
    } finally {
        await pool.end()
    }
}

main()
