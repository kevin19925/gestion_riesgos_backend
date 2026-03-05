// Test simple para verificar imports
console.log('1. Iniciando test...');

try {
  console.log('2. Importando prisma...');
  const prisma = require('./dist/prisma').default;
  console.log('3. Prisma importado OK');
  
  console.log('4. Importando audit service...');
  const auditService = require('./dist/services/audit.service');
  console.log('5. Audit service importado OK');
  
  console.log('6. Importando audit middleware...');
  const auditMiddleware = require('./dist/middleware/audit.middleware');
  console.log('7. Audit middleware importado OK');
  
  console.log('8. Importando app...');
  const app = require('./dist/app').default;
  console.log('9. App importado OK');
  
  console.log('✅ Todos los imports funcionan correctamente');
} catch (error) {
  console.error('❌ Error en import:', error.message);
  console.error(error.stack);
}
