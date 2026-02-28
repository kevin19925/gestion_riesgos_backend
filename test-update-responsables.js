/**
 * Script de prueba para updateResponsablesProceso
 * Ejecutar con: node test-update-responsables.js
 */

const axios = require('axios');

// Configuración
const API_URL = 'https://api-erm.comware.com.ec/api';
// const API_URL = 'http://localhost:3000/api'; // Para pruebas locales

async function testUpdateResponsables() {
    console.log('='.repeat(60));
    console.log('TEST: Actualizar responsables de un proceso');
    console.log('='.repeat(60));
    
    // Datos de prueba
    const procesoId = 11; // Proceso de prueba
    const responsables = [
        { usuarioId: 101, modo: 'proceso' },
        { usuarioId: 102, modo: 'director' }
    ];
    
    console.log('\n1. Datos a enviar:');
    console.log('   Proceso ID:', procesoId);
    console.log('   Responsables:', JSON.stringify(responsables, null, 2));
    
    try {
        console.log('\n2. Enviando request...');
        const response = await axios.put(
            `${API_URL}/procesos/${procesoId}/responsables`,
            { responsables },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('\n3. ✅ SUCCESS!');
        console.log('   Status:', response.status);
        console.log('   Data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('\n3. ❌ ERROR!');
        console.log('   Status:', error.response?.status);
        console.log('   Error:', error.response?.data);
        console.log('   Message:', error.message);
        
        if (error.response?.data) {
            console.log('\n   Detalles del error:');
            console.log('   -', error.response.data.error);
            if (error.response.data.details) {
                console.log('   -', error.response.data.details);
            }
            if (error.response.data.code) {
                console.log('   - Code:', error.response.data.code);
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
}

// Ejecutar test
testUpdateResponsables();
