/**
 * Script de prueba para verificar que las rutas de reuniones están registradas
 * Ejecutar: node test-rutas-reuniones.js
 */

const http = require('http');

const API_BASE = 'http://localhost:8080';

// Función helper para hacer peticiones
function makeRequest(path, method = 'GET', token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testRoutes() {
  console.log('🧪 Probando rutas de reuniones...\n');

  // Test 1: Health check
  console.log('1️⃣ Test: GET /api/health');
  try {
    const res = await makeRequest('/api/health');
    console.log(`   Status: ${res.status}`);
    console.log(`   Body: ${res.body}\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 2: Ruta de prueba de reuniones (sin token)
  console.log('2️⃣ Test: GET /api/procesos/test-reuniones (sin token)');
  try {
    const res = await makeRequest('/api/procesos/test-reuniones');
    console.log(`   Status: ${res.status}`);
    console.log(`   Body: ${res.body}\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 3: Asistentes de proceso (sin token - debe dar 401)
  console.log('3️⃣ Test: GET /api/procesos/1/asistentes (sin token)');
  try {
    const res = await makeRequest('/api/procesos/1/asistentes');
    console.log(`   Status: ${res.status}`);
    console.log(`   Body: ${res.body}\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 4: Reuniones de proceso (sin token - debe dar 401)
  console.log('4️⃣ Test: GET /api/procesos/1/reuniones (sin token)');
  try {
    const res = await makeRequest('/api/procesos/1/reuniones');
    console.log(`   Status: ${res.status}`);
    console.log(`   Body: ${res.body}\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  console.log('✅ Pruebas completadas\n');
  console.log('📝 Resultados esperados:');
  console.log('   - /api/health: 200 OK');
  console.log('   - /api/procesos/test-reuniones: 401 (requiere token)');
  console.log('   - /api/procesos/1/asistentes: 401 (requiere token)');
  console.log('   - /api/procesos/1/reuniones: 401 (requiere token)');
}

testRoutes().catch(console.error);
