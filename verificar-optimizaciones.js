/**
 * Script de Verificación de Optimizaciones
 * Ejecutar con: node verificar-optimizaciones.js
 */

const http = require('http');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const url = `${API_BASE_URL}${path}`;
        
        http.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                const hasGzip = res.headers['content-encoding'] === 'gzip';
                const contentLength = parseInt(res.headers['content-length'] || '0');
                
                resolve({
                    statusCode: res.statusCode,
                    duration,
                    hasGzip,
                    contentLength,
                    dataSize: data.length
                });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function verificarEndpoint(nombre, path, tiempoEsperado) {
    log(`\n📊 Verificando: ${nombre}`, 'cyan');
    log(`   Endpoint: ${path}`, 'blue');
    
    try {
        // Primera petición (sin caché)
        log('   🔄 Primera petición (sin caché)...', 'yellow');
        const result1 = await makeRequest(path);
        
        if (result1.statusCode !== 200) {
            log(`   ❌ Error: Status ${result1.statusCode}`, 'red');
            return false;
        }
        
        log(`   ⏱️  Tiempo: ${result1.duration}ms`, result1.duration <= tiempoEsperado ? 'green' : 'yellow');
        log(`   📦 Tamaño: ${result1.dataSize} bytes`, 'blue');
        log(`   🗜️  Compresión: ${result1.hasGzip ? 'Sí (gzip)' : 'No'}`, result1.hasGzip ? 'green' : 'yellow');
        
        // Segunda petición (con caché)
        await new Promise(resolve => setTimeout(resolve, 100));
        log('   🔄 Segunda petición (con caché)...', 'yellow');
        const result2 = await makeRequest(path);
        
        log(`   ⏱️  Tiempo: ${result2.duration}ms`, result2.duration <= tiempoEsperado ? 'green' : 'yellow');
        
        // Verificar mejora
        const mejora = ((result1.duration - result2.duration) / result1.duration * 100).toFixed(1);
        if (result2.duration < result1.duration) {
            log(`   ✅ Mejora con caché: ${mejora}%`, 'green');
        } else {
            log(`   ⚠️  Sin mejora con caché (puede ser normal si Redis no está activo)`, 'yellow');
        }
        
        // Verificar si cumple objetivo
        if (result1.duration <= tiempoEsperado) {
            log(`   ✅ Cumple objetivo (≤ ${tiempoEsperado}ms)`, 'green');
            return true;
        } else {
            log(`   ⚠️  No cumple objetivo (esperado ≤ ${tiempoEsperado}ms)`, 'yellow');
            return false;
        }
        
    } catch (error) {
        log(`   ❌ Error: ${error.message}`, 'red');
        return false;
    }
}

async function main() {
    log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
    log('║   VERIFICACIÓN DE OPTIMIZACIONES - Backend            ║', 'cyan');
    log('╚════════════════════════════════════════════════════════╝', 'cyan');
    
    log(`\n🌐 API Base URL: ${API_BASE_URL}`, 'blue');
    log('⏰ Iniciando verificación...', 'blue');
    
    const tests = [
        { nombre: 'Health Check', path: '/api/health', tiempo: 100 },
        { nombre: 'Procesos (Lista)', path: '/api/procesos', tiempo: 500 },
        { nombre: 'Riesgos (Lista)', path: '/api/riesgos?page=1&pageSize=50', tiempo: 1000 },
        { nombre: 'Estadísticas', path: '/api/riesgos/estadisticas', tiempo: 1000 },
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        const result = await verificarEndpoint(test.nombre, test.path, test.tiempo);
        if (result) {
            passed++;
        } else {
            failed++;
        }
    }
    
    log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
    log('║   RESUMEN DE VERIFICACIÓN                              ║', 'cyan');
    log('╚════════════════════════════════════════════════════════╝', 'cyan');
    
    log(`\n✅ Pruebas exitosas: ${passed}`, 'green');
    log(`❌ Pruebas fallidas: ${failed}`, failed > 0 ? 'red' : 'green');
    
    if (failed === 0) {
        log('\n🎉 ¡Todas las optimizaciones funcionan correctamente!', 'green');
    } else {
        log('\n⚠️  Algunas optimizaciones pueden necesitar ajustes.', 'yellow');
        log('   Verifica que el servidor esté corriendo y Redis esté activo.', 'yellow');
    }
    
    log('\n📝 Notas:', 'blue');
    log('   - Si Redis no está activo, el caché no funcionará pero el sistema seguirá operando.', 'blue');
    log('   - Los tiempos pueden variar según la carga del servidor y red.', 'blue');
    log('   - La compresión gzip reduce el tamaño de respuesta en 70-80%.', 'blue');
    
    log('\n');
}

main().catch(err => {
    log(`\n❌ Error fatal: ${err.message}`, 'red');
    log('   Verifica que el servidor backend esté corriendo.', 'yellow');
    process.exit(1);
});
