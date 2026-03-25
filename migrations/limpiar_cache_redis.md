# Limpiar Caché de Redis

Después de actualizar el schema y agregar el campo `responsable`, necesitas limpiar el caché de Redis para que el backend devuelva los datos actualizados.

## Opción 1: Reiniciar el backend (Más fácil)

Simplemente reinicia el servidor backend. Esto limpiará el caché automáticamente.

```bash
# Detener el servidor (Ctrl+C)
# Luego iniciar nuevamente
npm run dev
```

## Opción 2: Limpiar caché manualmente desde Redis CLI

Si tienes acceso a Redis CLI:

```bash
redis-cli
FLUSHDB
exit
```

## Opción 3: Esperar 5 minutos

El caché expira automáticamente después de 5 minutos (300 segundos).

## Verificación

Después de limpiar el caché, verifica que el campo `responsable` se devuelva correctamente:

1. Abre el navegador
2. Ve a la página de Normatividad
3. Abre las herramientas de desarrollador (F12)
4. Ve a la pestaña "Network"
5. Recarga la página
6. Busca la petición al endpoint `/api/procesos/{id}`
7. Verifica que en la respuesta, las normatividades incluyan el campo `responsable`

Ejemplo de respuesta esperada:
```json
{
  "normatividades": [
    {
      "id": 1,
      "numero": 1,
      "nombre": "...",
      "cumplimiento": "Parcial",
      "responsable": "Juan Pérez",
      ...
    }
  ]
}
```
