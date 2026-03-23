/**
 * SCRIPT DE PRUEBAS - SISTEMA DE TRAZABILIDAD
 * Prueba todos los endpoints del sistema de trazabilidad de planes
 */

const http = require('http');

// Configuración
const BASE_URL = 'localhost';
const PORT = 8080;

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Token de prueba (debes obtener uno válido primero)
let authToken = null;

// Resultados de las pruebas
const resultados = {
  exitosas: 0,
  fallidas: 0,
  detalles: []
};

/**
 * Función auxiliar para hacer peticiones HTTP
 */
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

/**
 * Registra resultado de una prueba
 */
function registrarResultado(nombre, exito, mensaje, datos = null) {
  if (exito) {
    resultados.exitosas++;
    console.log(`${colors.green}✓${colors.reset} ${nombre}`);
  } else {
    resultados.fallidas++;
    console.log(`${colors.red}✗${colors.reset} ${nombre}`);
  }
  
  if (mensaje) {
    console.log(`  ${colors.cyan}→${colors.reset} ${mensaje}`);
  }
  
  if (datos) {
    console.log(`  ${colors.yellow}Datos:${colors.reset}`, JSON.stringify(datos, null, 2));
  }
  
  resultados.detalles.push({ nombre, exito, mensaje, datos });
}

/**
 * PRUEBA 1: Health Check
 */
async function test1_healthCheck() {
  console.log(`\n${colors.blue}═══ PRUEBA 1: Health Check ═══${colors.reset}`);
  
  try {
    const response = await makeRequest('GET', '/api/health');
    
    if (response.statusCode === 200 && response.body.status === 'ok') {
      registrarResultado(
        'Health Check',
        true,
        `Servidor funcionando correctamente`,
        { status: response.body.status, db: response.body.db }
      );
      return true;
    } else {
      registrarResultado(
        'Health Check',
        false,
        `Estado inesperado: ${response.body.status}`
      );
      return false;
    }
  } catch (error) {
    registrarResultado('Health Check', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 2: Login (obtener token)
 */
async function test2_login() {
  console.log(`\n${colors.blue}═══ PRUEBA 2: Login ═══${colors.reset}`);
  
  try {
    // Credenciales de prueba
    const credentials = {
      username: 'usuario@ejemplo.com',
      password: 'password_de_prueba'
    };
    
    const response = await makeRequest('POST', '/api/auth/login', credentials);
    
    if (response.statusCode === 200 && response.body.token) {
      authToken = response.body.token;
      registrarResultado(
        'Login',
        true,
        `Token obtenido exitosamente`,
        { 
          usuario: response.body.usuario?.nombre, 
          role: response.body.usuario?.role,
          tokenLength: authToken.length 
        }
      );
      return true;
    } else {
      registrarResultado(
        'Login',
        false,
        `No se pudo obtener token. Usa credenciales válidas.`,
        response.body
      );
      return false;
    }
  } catch (error) {
    registrarResultado('Login', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 3: Estado del Cron
 */
async function test3_estadoCron() {
  console.log(`\n${colors.blue}═══ PRUEBA 3: Estado del Cron ═══${colors.reset}`);
  
  if (!authToken) {
    registrarResultado('Estado del Cron', false, 'No hay token de autenticación');
    return false;
  }
  
  try {
    const response = await makeRequest('GET', '/api/cron/estado', null, authToken);
    
    if (response.statusCode === 200) {
      registrarResultado(
        'Estado del Cron',
        true,
        `Cron activo: ${response.body.cron.activo}`,
        {
          proximaEjecucion: response.body.cron.proximaEjecucion,
          horaConfigurada: response.body.cron.horaConfigurada,
          alertas: response.body.alertas
        }
      );
      return true;
    } else {
      registrarResultado('Estado del Cron', false, `Status: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    registrarResultado('Estado del Cron', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 4: Obtener Alertas de Vencimiento
 */
async function test4_obtenerAlertas() {
  console.log(`\n${colors.blue}═══ PRUEBA 4: Obtener Alertas ═══${colors.reset}`);
  
  if (!authToken) {
    registrarResultado('Obtener Alertas', false, 'No hay token de autenticación');
    return false;
  }
  
  try {
    const response = await makeRequest(
      'GET',
      '/api/alertas-vencimiento',
      null,
      authToken
    );
    
    if (response.statusCode === 200) {
      registrarResultado(
        'Obtener Alertas',
        true,
        `${response.body.total} alertas encontradas`,
        {
          total: response.body.total,
          noLeidas: response.body.noLeidas,
          vencidas: response.body.vencidas,
          proximas: response.body.proximasAVencer
        }
      );
      return response.body;
    } else {
      registrarResultado('Obtener Alertas', false, `Status: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    registrarResultado('Obtener Alertas', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 5: Buscar una causa con plan para probar
 */
async function test5_buscarCausaConPlan() {
  console.log(`\n${colors.blue}═══ PRUEBA 5: Buscar Causa con Plan ═══${colors.reset}`);
  
  if (!authToken) {
    registrarResultado('Buscar Causa', false, 'No hay token de autenticación');
    return false;
  }
  
  try {
    // Buscar causas con planes
    const response = await makeRequest('GET', '/api/riesgos', null, authToken);
    
    if (response.statusCode === 200 && response.body.length > 0) {
      // Buscar un riesgo que tenga causas
      for (const riesgo of response.body.slice(0, 10)) {
        if (riesgo.causas && riesgo.causas.length > 0) {
          for (const causa of riesgo.causas) {
            if (causa.tipoGestion === 'PLAN' || causa.tipoGestion === 'AMBOS') {
              registrarResultado(
                'Buscar Causa con Plan',
                true,
                `Causa encontrada: ID ${causa.id}`,
                {
                  causaId: causa.id,
                  descripcion: causa.descripcion,
                  tipoGestion: causa.tipoGestion,
                  riesgo: riesgo.numeroIdentificacion
                }
              );
              return causa.id;
            }
          }
        }
      }
      
      registrarResultado(
        'Buscar Causa con Plan',
        false,
        'No se encontraron causas con planes en los primeros 10 riesgos'
      );
      return false;
    } else {
      registrarResultado('Buscar Causa', false, 'No se pudieron obtener riesgos');
      return false;
    }
  } catch (error) {
    registrarResultado('Buscar Causa', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 6: Obtener Trazabilidad de un Plan
 */
async function test6_obtenerTrazabilidad(causaId) {
  console.log(`\n${colors.blue}═══ PRUEBA 6: Obtener Trazabilidad ═══${colors.reset}`);
  
  if (!authToken) {
    registrarResultado('Obtener Trazabilidad', false, 'No hay token de autenticación');
    return false;
  }
  
  if (!causaId) {
    registrarResultado('Obtener Trazabilidad', false, 'No hay ID de causa para probar');
    return false;
  }
  
  try {
    const response = await makeRequest(
      'GET',
      `/api/causas/${causaId}/plan/trazabilidad`,
      null,
      authToken
    );
    
    if (response.statusCode === 200) {
      registrarResultado(
        'Obtener Trazabilidad',
        true,
        `Trazabilidad obtenida para causa ${causaId}`,
        {
          plan: response.body.plan,
          historialEstados: response.body.historialEstados?.length || 0,
          controlDerivado: response.body.controlDerivado ? 'Sí' : 'No'
        }
      );
      return true;
    } else {
      registrarResultado(
        'Obtener Trazabilidad',
        false,
        `Status: ${response.statusCode}`,
        response.body
      );
      return false;
    }
  } catch (error) {
    registrarResultado('Obtener Trazabilidad', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 7: Cambiar Estado de un Plan
 */
async function test7_cambiarEstado(causaId) {
  console.log(`\n${colors.blue}═══ PRUEBA 7: Cambiar Estado del Plan ═══${colors.reset}`);
  
  if (!authToken) {
    registrarResultado('Cambiar Estado', false, 'No hay token de autenticación');
    return false;
  }
  
  if (!causaId) {
    registrarResultado('Cambiar Estado', false, 'No hay ID de causa para probar');
    return false;
  }
  
  try {
    const data = {
      estado: 'en_progreso',
      observacion: 'Prueba automática del sistema de trazabilidad'
    };
    
    const response = await makeRequest(
      'PUT',
      `/api/causas/${causaId}/plan/estado`,
      data,
      authToken
    );
    
    if (response.statusCode === 200) {
      registrarResultado(
        'Cambiar Estado',
        true,
        `Estado cambiado exitosamente`,
        {
          estadoAnterior: response.body.estadoAnterior,
          estadoNuevo: response.body.estadoNuevo
        }
      );
      return true;
    } else {
      registrarResultado(
        'Cambiar Estado',
        false,
        `Status: ${response.statusCode}`,
        response.body
      );
      return false;
    }
  } catch (error) {
    registrarResultado('Cambiar Estado', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * Resumen Final
 */
function mostrarResumen() {
  console.log(`\n${colors.cyan}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}         RESUMEN DE PRUEBAS${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}`);
  
  const total = resultados.exitosas + resultados.fallidas;
  const porcentaje = total > 0 ? ((resultados.exitosas / total) * 100).toFixed(1) : 0;
  
  console.log(`\n${colors.green}Exitosas:${colors.reset} ${resultados.exitosas}`);
  console.log(`${colors.red}Fallidas:${colors.reset}  ${resultados.fallidas}`);
  console.log(`${colors.yellow}Total:${colors.reset}     ${total}`);
  console.log(`${colors.blue}Éxito:${colors.reset}     ${porcentaje}%\n`);
  
  if (resultados.fallidas > 0) {
    console.log(`${colors.red}Pruebas fallidas:${colors.reset}`);
    resultados.detalles
      .filter(r => !r.exito)
      .forEach(r => {
        console.log(`  ${colors.red}✗${colors.reset} ${r.nombre}: ${r.mensaje}`);
      });
  }
  
  console.log(`\n${colors.cyan}═══════════════════════════════════════${colors.reset}\n`);
}

/**
 * Ejecutar todas las pruebas
 */
async function ejecutarPruebas() {
  console.log(`${colors.cyan}╔═══════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║  PRUEBAS DEL SISTEMA DE TRAZABILIDAD  ║${colors.reset}`);
  console.log(`${colors.cyan}╚═══════════════════════════════════════╝${colors.reset}`);
  
  // Prueba 1: Health Check
  const healthOk = await test1_healthCheck();
  if (!healthOk) {
    console.log(`\n${colors.red}El servidor no está funcionando correctamente. Abortando pruebas.${colors.reset}\n`);
    return;
  }
  
  // Prueba 2: Login
  const loginOk = await test2_login();
  if (!loginOk) {
    console.log(`\n${colors.yellow}No se pudo obtener token. Las siguientes pruebas se saltarán.${colors.reset}`);
    console.log(`${colors.yellow}Actualiza las credenciales en el script si es necesario.${colors.reset}\n`);
  }
  
  // Prueba 3: Estado del Cron
  if (loginOk) {
    await test3_estadoCron();
  }
  
  // Prueba 4: Obtener Alertas
  if (loginOk) {
    await test4_obtenerAlertas();
  }
  
  // Prueba 5: Buscar Causa con Plan
  let causaId = null;
  if (loginOk) {
    causaId = await test5_buscarCausaConPlan();
  }
  
  // Prueba 6: Obtener Trazabilidad
  if (loginOk && causaId) {
    await test6_obtenerTrazabilidad(causaId);
  }
  
  // Prueba 7: Cambiar Estado
  if (loginOk && causaId) {
    await test7_cambiarEstado(causaId);
  }
  
  // Mostrar resumen
  mostrarResumen();
}

// Ejecutar
ejecutarPruebas().catch(error => {
  console.error(`${colors.red}Error fatal:${colors.reset}`, error);
  process.exit(1);
});
