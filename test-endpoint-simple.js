const http = require('http');

async function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  // Login
  const login = await makeRequest('POST', '/api/auth/login', {
    username: 'usuario@ejemplo.com',
    password: 'password_de_prueba'
  });
  
  if (login.statusCode !== 200) {
    console.log('❌ Login falló:', login);
    return;
  }
  
  const token = login.body.token;
  console.log('✅ Token obtenido');
  
  // Test endpoint de prueba
  const testAuth = await makeRequest('GET', '/api/test-auth', null, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('\n/api/test-auth:');
  console.log('  Status:', testAuth.statusCode);
  console.log('  Body:', JSON.stringify(testAuth.body, null, 2));
  
  // Test alertas
  const alertas = await makeRequest('GET', '/api/alertas-vencimiento', null, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('\n/api/alertas-vencimiento:');
  console.log('  Status:', alertas.statusCode);
  console.log('  Body:', JSON.stringify(alertas.body, null, 2));
  
  // Test cron (para comparar)
  const cron = await makeRequest('GET', '/api/cron/estado', null, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('\n/api/cron/estado:');
  console.log('  Status:', cron.statusCode);
  console.log('  Body:', JSON.stringify(cron.body, null, 2).substring(0, 100) + '...');
}

test().catch(console.error);
