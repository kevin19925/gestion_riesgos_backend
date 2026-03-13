import dotenv from 'dotenv';
dotenv.config();

import { procesarMensajeIA } from '../src/services/ia.service';

async function main() {
  try {
    console.log('=== Test IA (procesarMensajeIA) ===');
    const result = await procesarMensajeIA({
      userId: '1',
      userName: 'test@example.com',
      rol: 'tester',
      message: 'Hola, soy un usuario de pruebas del sistema de riesgos. ¿Qué puedes hacer por mí?',
    });
    console.log('conversationId:', result.conversationId);
    console.log('answer:', result.answer);
  } catch (err) {
    console.error('Error en test-ia:', err);
    process.exit(1);
  }
}

main();

