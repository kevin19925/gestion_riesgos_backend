import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function count() {
    const configCount = await prisma.mapaConfig.count();
    const riskCount = await prisma.riesgo.count();
    const evalCount = await prisma.evaluacionRiesgo.count();
    const userCount = await prisma.usuario.count();
    console.log({ configCount, riskCount, evalCount, userCount });
    process.exit(0);
}
count();
