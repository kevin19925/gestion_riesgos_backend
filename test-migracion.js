const axios = require('axios');

const BASE_URL = 'http://localhost:8080/api';

// Colores para la consola
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

function logTest(name) {
  console.log('\n' + '='.repeat(60));
  log(`TEST: ${name}`, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Variables globales para almacenar datos entre pruebas
let testData = {
  tipologia3Id: null,
  tipologia4Id: null,
  planId: null,
  causaId: null
};

// Función para hacer peticiones con manejo de errores
async function request(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// ============================================================================
// PRUEBAS
// ============================================================================

async function test1_ListarTipologias() {
  logTest('1. Listar Tipologías Extendidas');
  
  const result = await request('GET', '/catalogos/tipologias-extendidas');
  
  if (result.success) {
    logSuccess(`Tipologías encontradas: ${result.data.length || 0}`);
    if (result.data.length > 0) {
      logInfo(`Primera tipología: ${JSON.stringify(result.data[0], null, 2)}`);
    }
    return true;
  } else {
    logError(`Error: ${JSON.stringify(result.error)}`);
    return false;
  }
}

async function test2_CrearTipologia3() {
  logTest('2. Crear Tipología Nivel 3');
  
  const data = {
    nivel: 3,
    nombre: `Test Tipología 3 - ${Date.now()}`,
    descripcion: 'Tipología de prueba nivel 3',
    activo: true
  };
  
  const result = await request('POST', '/catalogos/tipologias-extendidas', data);
  
  if (result.success) {
    testData.tipologia3Id = result.data.id;
    logSuccess(`Tipología nivel 3 creada con ID: ${testData.tipologia3Id}`);
    logInfo(`Datos: ${JSON.stringify(result.data, null, 2)}`);
    return true;
  } else {
    logError(`Error: ${JSON.stringify(result.error)}`);
    return false;
  }
}

async function test3_CrearTipologia4() {
  logTest('3. Crear Tipología Nivel 4');
  
  const data = {
    nivel: 4,
    nombre: `Test Tipología 4 - ${Date.now()}`,
    descripcion: 'Tipología de prueba nivel 4',
    activo: true
  };
  
  const result = await request('POST', '/catalogos/tipologias-extendidas', data);
  
  if (result.success) {
    testData.tipologia4Id = result.data.id;
    logSuccess(`Tipología nivel 4 creada con ID: ${testData.tipologia4Id}`);
    logInfo(`Datos: ${JSON.stringify(result.data, null, 2)}`);
    return true;
  } else {
    logError(`Error: ${JSON.stringify(result.error)}`);
    return false;
  }
}

async function test4_ValidarNivelInvalido() {
  logTest('4. Validar Nivel Inválido (debe fallar)');
  
  const data = {
    nivel: 5,
    nombre: 'Tipología Inválida',
    descripcion: 'Esto debería fallar'
  };
  
  const result = await request('POST', '/catalogos/tipologias-extendidas', data);
  
  if (!result.success && result.status === 400) {
    logSuccess('Validación correcta: rechazó nivel inválido');
    logInfo(`Error esperado: ${JSON.stringify(result.error)}`);
    return true;
  } else {
    logError('La validación no funcionó correctamente');
    return false;
  }
}

async function test5_ListarPlanes() {
  logTest('5. Listar Planes de Acción');
  
  const result = await request('GET', '/planes-accion');
  
  if (result.success) {
    const planes = result.data.planes || [];
    logSuccess(`Planes encontrados: ${planes.length}`);
    
    if (planes.length > 0) {
      testData.planId = planes[0].id;
      testData.causaId = planes[0].causaRiesgoId;
      logInfo(`Primer plan ID: ${testData.planId}, Causa ID: ${testData.causaId}`);
      logInfo(`Estado: ${planes[0].estado}`);
      logInfo(`Descripción: ${planes[0].descripcion}`);
    } else {
      logWarning('No hay planes en la base de datos para probar');
    }
    return true;
  } else {
    logError(`Error: ${JSON.stringify(result.error)}`);
    return false;
  }
}

async function test6_ObtenerTrazabilidad() {
  logTest('6. Obtener Trazabilidad de un Plan');
  
  if (!testData.causaId) {
    logWarning('No hay causa ID disponible, saltando prueba');
    return true;
  }
  
  const result = await request('GET', `/causas/${testData.causaId}/plan/trazabilidad`);
  
  if (result.success) {
    logSuccess('Trazabilidad obtenida correctamente');
    logInfo(`Plan: ${result.data.plan?.descripcion || 'N/A'}`);
    logInfo(`Estados en historial: ${result.data.historialEstados?.length || 0}`);
    logInfo(`Control derivado: ${result.data.controlDerivado ? 'Sí' : 'No'}`);
    logInfo(`Eventos: ${result.data.eventos?.length || 0}`);
    return true;
  } else {
    if (result.status === 404) {
      logWarning('Plan no encontrado (esperado si no hay planes)');
      return true;
    }
    logError(`Error: ${JSON.stringify(result.error)}`);
    return false;
  }
}

async function test7_CambiarEstadoPlan() {
  logTest('7. Cambiar Estado de un Plan');
  
  if (!testData.causaId) {
    logWarning('No hay causa ID disponible, saltando prueba');
    return true;
  }
  
  const data = {
    estado: 'EN_REVISION',
    observacion: 'Prueba de cambio de estado desde test automatizado'
  };
  
  const result = await request('PUT', `/causas/${testData.causaId}/plan/estado`, data);
  
  if (result.success) {
    logSuccess('Estado cambiado correctamente');
    logInfo(`Estado anterior: ${result.data.estadoAnterior}`);
    logInfo(`Estado nuevo: ${result.data.estadoNuevo}`);
    return true;
  } else {
    if (result.status === 404) {
      logWarning('Plan no encontrado (esperado si no hay planes)');
      return true;
    }
    logError(`Error: ${JSON.stringify(result.error)}`);
    return false;
  }
}

async function test8_VerificarDatosEnTablas() {
  logTest('8. Verificar Estructura de Datos');
  
  // Verificar que los planes vienen de la tabla PlanAccion
  const result = await request('GET', '/planes-accion');
  
  if (result.success) {
    const planes = result.data.planes || [];
    
    if (planes.length > 0) {
      const plan = planes[0];
      
      // Verificar campos esperados de la tabla PlanAccion
      const camposEsperados = ['id', 'causaRiesgoId', 'descripcion', 'estado', 'responsable'];
      const camposFaltantes = camposEsperados.filter(campo => !(campo in plan));
      
      if (camposFaltantes.length === 0) {
        logSuccess('Estructura de datos correcta');
        logInfo('Campos verificados: ' + camposEsperados.join(', '));
      } else {
        logError('Campos faltantes: ' + camposFaltantes.join(', '));
        return false;
      }
      
      // Verificar que NO tiene campos obsoletos
      const camposObsoletos = ['gestion', 'tipoGestion'];
      const camposObsoletosEncontrados = camposObsoletos.filter(campo => campo in plan);
      
      if (camposObsoletosEncontrados.length === 0) {
        logSuccess('No se encontraron campos obsoletos');
      } else {
        logWarning('Campos obsoletos encontrados: ' + camposObsoletosEncontrados.join(', '));
      }
    }
    
    return true;
  } else {
    logError(`Error: ${JSON.stringify(result.error)}`);
    return false;
  }
}

// ============================================================================
// EJECUTAR TODAS LAS PRUEBAS
// ============================================================================

async function runAllTests() {
  log('\n' + '█'.repeat(60), 'cyan');
  log('  PRUEBAS DE MIGRACIÓN DE NORMALIZACIÓN', 'cyan');
  log('█'.repeat(60) + '\n', 'cyan');
  
  const tests = [
    { name: 'Listar Tipologías', fn: test1_ListarTipologias },
    { name: 'Crear Tipología Nivel 3', fn: test2_CrearTipologia3 },
    { name: 'Crear Tipología Nivel 4', fn: test3_CrearTipologia4 },
    { name: 'Validar Nivel Inválido', fn: test4_ValidarNivelInvalido },
    { name: 'Listar Planes', fn: test5_ListarPlanes },
    { name: 'Obtener Trazabilidad', fn: test6_ObtenerTrazabilidad },
    { name: 'Cambiar Estado Plan', fn: test7_CambiarEstadoPlan },
    { name: 'Verificar Estructura', fn: test8_VerificarDatosEnTablas }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      logError(`Error inesperado en ${test.name}: ${error.message}`);
      results.push({ name: test.name, passed: false });
    }
  }
  
  // Resumen
  log('\n' + '█'.repeat(60), 'cyan');
  log('  RESUMEN DE PRUEBAS', 'cyan');
  log('█'.repeat(60) + '\n', 'cyan');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(result => {
    if (result.passed) {
      logSuccess(`${result.name}`);
    } else {
      logError(`${result.name}`);
    }
  });
  
  log('\n' + '-'.repeat(60));
  log(`Total: ${results.length} | Exitosas: ${passed} | Fallidas: ${failed}`, 
      failed === 0 ? 'green' : 'yellow');
  log('-'.repeat(60) + '\n');
  
  if (failed === 0) {
    log('🎉 ¡TODAS LAS PRUEBAS PASARON!', 'green');
  } else {
    log('⚠️  Algunas pruebas fallaron. Revisa los logs arriba.', 'yellow');
  }
}

// Ejecutar
runAllTests().catch(error => {
  logError(`Error fatal: ${error.message}`);
  process.exit(1);
});
