# Migraciones

Cada cambio de esquema vive acá, en un archivo numerado que **no se edita
nunca una vez aplicado**. Si algo estuvo mal, se corrige con una migración
nueva.

## Por qué

Hasta ahora el SQL se pegaba a mano en el editor de Supabase. Eso funciona
con una sola base y una sola persona. Con una base de test y otra de
producción —y más adelante, con clientes pagando— hace falta saber con
certeza qué se aplicó y dónde: una migración a medio aplicar en producción
no se arregla adivinando.

Los archivos de `supabase/*.sql` (fuera de esta carpeta) son **documentación**
del esquema: describen cómo quedó cada tabla. Estos de acá son **el historial**
de cómo se llegó.

## Nombre de los archivos

    AAAAMMDD_NNNN_descripcion_corta.sql

## Orden de aplicación

Siempre **test primero**, se verifica, y recién después producción.

| Migración | test | producción |
|---|---|---|
| `20260917_0001_borrar_tabla_facturas.sql` | aplicada | pendiente |
| `20260917_0002_revocar_execute_triggers.sql` | aplicada | pendiente |
