/**
 * PRUEBA SIMPLE - ALERTAS
 * Debug del problema de autenticación
 */

const http = require('http');

const BASE_URL = 'localhost';
const PORT = 8080;

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    console.log('\n📤 REQUEST:');
    console.log('  Method:', method);
    console.log('  Path:', path);
    console.log('  Headers:', JSON.stringify(options.headers, null, 2));

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        console.log('\n📥 RESPONSE:');
        console.log('  Status:', res.statusCode);
        console.log('  Headers:', JSON.stringify(res.headers, null, 2));
        console.log('  Body:', body);

        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ ERROR:', error.message);
      reject(error);
    });

    if (data) {
      const jsonData = JSON.stringify(data);
      console.log('  Body:', jsonData);
      req.write(jsonData);
    }

    req.end();
  });
}

async function test() {
  console.log('═══════════════════════════════════════');
  console.log('  PRUEBA SIMPLE - ALERTAS');
  console.log('═══════════════════════════════════════\n');

  // PASO 1: Login
  console.log('PASO 1: Login');
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    username: 'usuario@ejemplo.com',
    password: 'password_de_prueba'
  });

  if (loginResponse.statusCode !== 200 || !loginResponse.body.token) {
    console.error('\n❌ Login falló');
    return;
  }

  const token = loginResponse.body.token;
  console.log('\n✅ Token obtenido:', token.substring(0, 50) + '...');

  // PASO 2: Obtener Alertas
  console.log('\n\nPASO 2: Obtener Alertas');
  const alertasResponse = await makeRequest(
    'GET',
    '/api/alertas-vencimiento',
    null,
    { 'Authorization': `Bearer ${token}` }
  );

  if (alertasResponse.statusCode === 200) {
    console.log('\n✅ Alertas obtenidas exitosamente');
    console.log('Total:', alertasResponse.body.total);
  } else {
    console.log('\n❌ Error al obtener alertas');
    console.log('Status:', alertasResponse.statusCode);
    console.log('Body:', alertasResponse.body);
  }

  // PASO 3: Estado del Cron (para comparar)
  console.log('\n\nPASO 3: Estado del Cron (para comparar)');
  const cronResponse = await makeRequest(
    'GET',
    '/api/cron/estado',
    null,
    { 'Authorization': `Bearer ${token}` }
  );

  if (cronResponse.statusCode === 200) {
    console.log('\n✅ Estado del cron obtenido exitosamente');
  } else {
    console.log('\n❌ Error al obtener estado del cron');
  }

  console.log('\n═══════════════════════════════════════\n');
}

test().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
