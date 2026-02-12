import prisma from './src/prisma';

async function fixProcesoTipo() {
  console.log('Actualizando tipos de proceso...');
  
  // Mapeo de números a nombres
  const tipoMap: Record<string, string> = {
    '1': 'Operacional',
    '2': 'Estratégico',
    '3': 'Apoyo',
    '4': 'Cumplimiento',
    '5': 'Gestión'
  };

  // Obtener todos los procesos
  const procesos = await prisma.proceso.findMany();
  
  for (const proceso of procesos) {
    if (proceso.tipo && tipoMap[proceso.tipo]) {
      const nuevoTipo = tipoMap[proceso.tipo];
      console.log(`Proceso ${proceso.id} (${proceso.nombre}): ${proceso.tipo} → ${nuevoTipo}`);
      
      await prisma.proceso.update({
        where: { id: proceso.id },
        data: { tipo: nuevoTipo }
      });
    }
  }
  
  console.log('✅ Tipos de proceso actualizados');
  await prisma.$disconnect();
}

fixProcesoTipo().catch(console.error);
