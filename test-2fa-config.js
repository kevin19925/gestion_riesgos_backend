/**
 * Script de prueba para verificar que el endpoint de configuración 2FA funciona
 */

const prisma = require('./dist/prisma').default;

async function testConfig() {
  try {
    console.log('1. Probando conexión a base de datos...');
    await prisma.$connect();
    console.log('✓ Conexión exitosa\n');

    console.log('2. Verificando que la tabla ConfiguracionSistema existe...');
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'ConfiguracionSistema'
      ) AS exists
    `;
    console.log('Tabla existe:', tableExists[0].exists);
    console.log('');

    console.log('3. Intentando leer configuración 2FA...');
    const configs = await prisma.configuracionSistema.findMany({
      where: {
        clave: {
          in: [
            '2fa_habilitado_global',
            '2fa_obligatorio',
            '2fa_ventana_tiempo',
            '2fa_max_intentos',
            '2fa_dispositivos_confiables_dias'
          ]
        }
      }
    });

    console.log(`✓ Se encontraron ${configs.length} registros de configuración:`);
    configs.forEach(config => {
      console.log(`  - ${config.clave}: ${config.valor}`);
    });
    console.log('');

    if (configs.length === 0) {
      console.log('⚠ No se encontraron registros de configuración 2FA');
      console.log('Ejecuta el script: migrations/insert_2fa_default_config.sql');
    } else if (configs.length < 5) {
      console.log(`⚠ Solo se encontraron ${configs.length} de 5 registros esperados`);
      console.log('Ejecuta el script: migrations/insert_2fa_default_config.sql');
    } else {
      console.log('✓ Configuración 2FA completa');
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testConfig();
