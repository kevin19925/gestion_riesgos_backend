const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.usuario.findMany({
            select: {
                email: true,
                password: true,
                role: true
            }
        });
        console.log('USERS_IN_DB:');
        console.log(JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('ERROR_LISTING_USERS:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
