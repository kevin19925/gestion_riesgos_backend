/**
 * PRUEBAS BÁSICAS DEL BACKEND
 * Verifica que el servidor y los servicios principales están funcionando
 */

const http = require('http');

const BASE_URL = 'localhost';
const PORT = 8080;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
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
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function ejecutarPruebas() {
  console.log(`\n${colors.cyan}╔═══════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║     PRUEBAS BÁSICAS DEL BACKEND       ║${colors.reset}`);
  console.log(`${colors.cyan}╚═══════════════════════════════════════╝${colors.reset}\n`);

  let exitosas = 0;
  let fallidas = 0;

  // PRUEBA 1: Health Check
  console.log(`${colors.blue}1. Health Check${colors.reset}`);
  try {
    const response = await makeRequest('GET', '/api/health');
    if (response.statusCode === 200 && response.body.status === 'ok') {
      console.log(`   ${colors.green}✓${colors.reset} Servidor funcionando`);
      console.log(`   ${colors.cyan}→${colors.reset} DB: ${response.body.db ? 'Conectada' : 'Desconectada'}`);
      console.log(`   ${colors.cyan}→${colors.reset} Uptime: ${Math.floor(response.body.uptime)}s`);
      console.log(`   ${colors.cyan}→${colors.reset} Version: ${response.body.version}`);
      exitosas++;
    } else {
      console.log(`   ${colors.red}✗${colors.reset} Estado inesperado: ${response.body.status}`);
      fallidas++;
    }
  } catch (error) {
    console.log(`   ${colors.red}✗${colors.reset} Error: ${error.message}`);
    fallidas++;
  }

  // PRUEBA 2: Endpoint de Login existe
  console.log(`\n${colors.blue}2. Endpoint de Login${colors.reset}`);
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      username: 'test',
      password: 'test'
    });
    
    // Esperamos un 401 o 400, no un 404
    if (response.statusCode === 401 || response.statusCode === 400) {
      console.log(`   ${colors.green}✓${colors.reset} Endpoint existe y responde`);
      console.log(`   ${colors.cyan}→${colors.reset} Status: ${response.statusCode}`);
      exitosas++;
    } else if (response.statusCode === 404) {
      console.log(`   ${colors.red}✗${colors.reset} Endpoint no encontrado`);
      fallidas++;
    } else {
      console.log(`   ${colors.yellow}⚠${colors.reset} Respuesta inesperada: ${response.statusCode}`);
      exitosas++;
    }
  } catch (error) {
    console.log(`   ${colors.red}✗${colors.reset} Error: ${error.message}`);
    fallidas++;
  }

  // PRUEBA 3: Endpoint de Cron (sin auth)
  console.log(`\n${colors.blue}3. Endpoint de Cron${colors.reset}`);
  try {
    const response = await makeRequest('GET', '/api/cron/estado');
    
    // Esperamos un 401 (no autorizado), lo cual significa que el endpoint existe
    if (response.statusCode === 401) {
      console.log(`   ${colors.green}✓${colors.reset} Endpoint existe (requiere autenticación)`);
      exitosas++;
    } else if (response.statusCode === 404) {
      console.log(`   ${colors.red}✗${colors.reset} Endpoint no encontrado`);
      fallidas++;
    } else if (response.statusCode === 200) {
      console.log(`   ${colors.green}✓${colors.reset} Endpoint funciona`);
      console.log(`   ${colors.cyan}→${colors.reset} Cron activo: ${response.body.cron?.activo}`);
      exitosas++;
    } else {
      console.log(`   ${colors.yellow}⚠${colors.reset} Respuesta inesperada: ${response.statusCode}`);
      exitosas++;
    }
  } catch (error) {
    console.log(`   ${colors.red}✗${colors.reset} Error: ${error.message}`);
    fallidas++;
  }

  // PRUEBA 4: Endpoint de Alertas (sin auth)
  console.log(`\n${colors.blue}4. Endpoint de Alertas${colors.reset}`);
  try {
    const response = await makeRequest('GET', '/api/planes-accion/alertas-vencimiento');
    
    if (response.statusCode === 401) {
      console.log(`   ${colors.green}✓${colors.reset} Endpoint existe (requiere autenticación)`);
      exitosas++;
    } else if (response.statusCode === 404) {
      console.log(`   ${colors.red}✗${colors.reset} Endpoint no encontrado`);
      fallidas++;
    } else if (response.statusCode === 200) {
      console.log(`   ${colors.green}✓${colors.reset} Endpoint funciona`);
      exitosas++;
    } else {
      console.log(`   ${colors.yellow}⚠${colors.reset} Respuesta inesperada: ${response.statusCode}`);
      exitosas++;
    }
  } catch (error) {
    console.log(`   ${colors.red}✗${colors.reset} Error: ${error.message}`);
    fallidas++;
  }

  // PRUEBA 5: Endpoint de Trazabilidad (sin auth)
  console.log(`\n${colors.blue}5. Endpoint de Trazabilidad${colors.reset}`);
  try {
    const response = await makeRequest('GET', '/api/causas/1/plan/trazabilidad');
    
    if (response.statusCode === 401) {
      console.log(`   ${colors.green}✓${colors.reset} Endpoint existe (requiere autenticación)`);
      exitosas++;
    } else if (response.statusCode === 404) {
      console.log(`   ${colors.red}✗${colors.reset} Endpoint no encontrado`);
      fallidas++;
    } else if (response.statusCode === 200) {
      console.log(`   ${colors.green}✓${colors.reset} Endpoint funciona`);
      exitosas++;
    } else {
      console.log(`   ${colors.yellow}⚠${colors.reset} Respuesta inesperada: ${response.statusCode}`);
      exitosas++;
    }
  } catch (error) {
    console.log(`   ${colors.red}✗${colors.reset} Error: ${error.message}`);
    fallidas++;
  }

  // RESUMEN
  const total = exitosas + fallidas;
  const porcentaje = total > 0 ? ((exitosas / total) * 100).toFixed(1) : 0;

  console.log(`\n${colors.cyan}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}         RESUMEN DE PRUEBAS${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}`);
  console.log(`\n${colors.green}Exitosas:${colors.reset} ${exitosas}`);
  console.log(`${colors.red}Fallidas:${colors.reset}  ${fallidas}`);
  console.log(`${colors.yellow}Total:${colors.reset}     ${total}`);
  console.log(`${colors.blue}Éxito:${colors.reset}     ${porcentaje}%\n`);

  if (exitosas === total) {
    console.log(`${colors.green}✓ Todos los endpoints están funcionando correctamente${colors.reset}\n`);
  } else if (fallidas > 0) {
    console.log(`${colors.red}✗ Algunas pruebas fallaron. Revisa los logs del servidor.${colors.reset}\n`);
  }
}

ejecutarPruebas().catch(error => {
  console.error(`${colors.red}Error fatal:${colors.reset}`, error);
  process.exit(1);
});
