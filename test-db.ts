import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const url = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '')

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: url
        }
    }
})

async function main() {
    console.log('Testing connection...')
    try {
        const list = await prisma.cargo.findMany({ take: 1 })
        console.log('Connection successful, cargos count:', list.length)
    } catch (e) {
        console.error('Connection failed:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
