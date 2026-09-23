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
| `20260917_0001_borrar_tabla_facturas.sql` | aplicada | aplicada (2026-09-18) |
| `20260917_0002_revocar_execute_triggers.sql` | aplicada | aplicada (2026-09-18) |
| `20260918_0003_denuncia_conductor_y_terceros.sql` | aplicada | aplicada (2026-09-18) |
| `20260918_0004_asegurados.sql` | aplicada | aplicada (2026-09-18) |
| `20260918_0005_unificar_asegurados.sql` | aplicada | aplicada (2026-09-18) |
| `20260918_0006_endurecer_asegurados.sql` | aplicada | aplicada (2026-09-18) |
| `20260918_0007_enganchar_por_documento.sql` | aplicada | aplicada (2026-09-18) |
| `20260921_0008_ficha_aprende_documento.sql` | aplicada | aplicada (2026-09-21) |
| `20260922_0009_multiempresa_base.sql` | aplicada | pendiente |
| `20260923_0010_marca_y_logos.sql` | aplicada | pendiente |

## Nota sobre producción

El 2026-09-18, analizando duplicados, se instalaron `pg_trgm` y `unaccent` en
producción fuera de toda migración (dentro de una consulta que se había
anunciado como de solo lectura). `pg_trgm` la necesitaba la 0004 igual;
`unaccent` no la usa nada: **se borró de producción el 2026-09-18** con el ok de
Nico, después de verificar en prod que no la usaba ninguna función, índice,
columna ni vista. `pg_trgm` queda instalada.

## Pase a producción del 2026-09-18

Las siete se aplicaron en orden, **antes** de pasar el código: todas agregan y
ninguna cambia lo que usaba el portal viejo, así que el sitio siguió andando
entre un paso y otro. Antes se verificó en producción que `facturas` tenía 0
filas y nada la referenciaba, y que las policies de `anon` no llaman a
`es_activo()`. Después:

- La denuncia se probó insertando como `anon` con el formulario nuevo completo,
  dentro de un bloque que termina en `raise exception` para que Postgres lo
  deshaga todo (incluidas las notificaciones del trigger). No quedó rastro.
- Como visitante sin cuenta: ninguna tabla devuelve filas y las funciones de
  asegurados, de rol y de trigger responden 401/404.
- Los avisos del linter son los mismos tres conocidos de test (extensiones en
  `public`, la API de asegurados es `security definer` a propósito, y la
  protección de contraseñas filtradas, que es del plan Pro).

## Enganche de los siniestros viejos (producción, 2026-09-21)

Con el ok de Nico se corrió en producción el cuerpo de
`asegurados_enganchar_siniestros(false)` (la versión de la 0007) más el de
`asegurados_buscar_parecidos(0.70)`, a mano por SQL: las dos funciones exigen
sesión de organizador y desde el editor no la hay. Antes se repitió la
simulación. Resultado: los 28 siniestros activos quedaron con ficha (20 fichas,
todas sin documento: los siniestros viejos nunca lo pidieron) y un solo par
para revisar en Administración → Asegurados duplicados. Los eliminados no
llevan ficha, a propósito.
