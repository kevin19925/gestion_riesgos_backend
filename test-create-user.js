// Script temporal para probar la creación de usuario y ver el error exacto
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCreateUser() {
    try {
        console.log('Intentando crear usuario de prueba...');
        
        const user = await prisma.usuario.create({
            data: {
                nombre: 'Test Usuario',
                email: 'test@test.com',
                password: '1234',
                roleId: 5,
                cargoId: 86,
                activo: true
            }
        });
        
        console.log('Usuario creado exitosamente:', user);
    } catch (error) {
        console.error('Error completo:', error);
        console.error('Error code:', error.code);
        console.error('Error meta:', error.meta);
        
        // Intentar obtener más detalles del error
        if (error.meta && error.meta.driverAdapterError) {
            console.error('Driver error:', error.meta.driverAdapterError);
            console.error('Driver error cause:', error.meta.driverAdapterError.cause);
        }
    } finally {
        await prisma.$disconnect();
    }
}

testCreateUser();
