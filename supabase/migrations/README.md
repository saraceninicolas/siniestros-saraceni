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
| `20260922_0009_multiempresa_base.sql` | aplicada | aplicada (2026-09-30) |
| `20260923_0010_marca_y_logos.sql` | aplicada | aplicada (2026-09-30) |
| `20260925_0011_org_id_en_el_portal.sql` | aplicada | aplicada (2026-09-30) |
| `20260925_0012_archivos_y_modulos_por_empresa.sql` | aplicada | aplicada (2026-09-30) |
| `20260925_0013_empresa_por_defecto.sql` | aplicada | aplicada (2026-09-30) |
| `20260925_0014_logo_de_la_empresa_de_casa.sql` | aplicada | aplicada (2026-09-30) |
| `20260925_0015_org_publica_sin_slug.sql` | aplicada | aplicada (2026-09-30) |
| `20260925_0016_default_de_carga_publica.sql` | aplicada | aplicada (2026-09-30) |
| `20260928_0017_formularios_publicos_por_modulo.sql` | aplicada | aplicada (2026-09-30) |
| `20260929_0018_companias_por_empresa.sql` | aplicada | aplicada (2026-09-30) |
| `20260930_0019_pipeline_comercial_y_acciones.sql` | aplicada | aplicada (2026-09-30) |
| `20261002_0020_aviso_por_mail_al_toque.sql` | aplicada (2026-10-02) | **pendiente, y sin apuro** |

## El pase a producción de la 0009 a la 0018 (multiempresa)

Van todas juntas, y **el orden importa**, porque en el medio hay un momento en
que la base pide algo que el código viejo todavía no manda:

1. `0009` y `0010`: agregan tablas nuevas. No tocan nada de lo que usa el
   portal actual, así que se pueden aplicar con el sitio andando.
2. `0011`, `0013`, `0015`, `0016`: le ponen dueño a las filas. El portal
   viejo sigue funcionando porque el dueño lo pone la base (los `default`).
3. **Recién ahí, desplegar el código.** Desde este punto el portal sube los
   archivos a la carpeta de cada empresa.
4. `0012` al final: cierra los buckets por carpeta. Si se aplicara antes del
   paso 3, el portal seguiría subiendo a la raíz y la base le rebotaría cada
   archivo adjunto.
5. `0014`: le deja a la empresa de casa su logo de siempre.
6. `0017` también al final, por lo mismo que la 0012: cierra los formularios
   públicos de los brokers que no contrataron el módulo, y las páginas nuevas
   son las que saben avisarlo. Aplicada antes de desplegar, un visitante vería
   el error crudo de la policy en vez del aviso.
7. `0018` puede ir en cualquier momento: crea la tabla de compañías y la
   siembra. El código viejo no la mira, y el nuevo, si no la encuentra, usa la
   lista de siempre. **Al dar de alta una empresa hay que sembrarla**:
   `select public.sembrar_companias('<org_id>')`.

Después de aplicar: correr `supabase/tests/aislamiento.sql` **en test** (no en
producción: inserta para probar, y aunque hace rollback no vale el riesgo) y
`npm test`, que pega contra test por red.

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

## El pase a producción del 2026-09-30

Se aplicaron las once (0009 → 0019) en el orden documentado, con el sitio
andando. Antes: se comparó columna por columna el esquema de las dos bases (no
había ninguna diferencia fuera de `org_id`) y se anotaron los totales de cada
tabla para contrastarlos después.

Cómo se verificó, además de que ninguna migración diera error:

- **Las 69 policies de producción tienen la misma huella md5 que las de test**,
  y las funciones del multiempresa también, una por una. Las únicas diferencias
  que quedan son de antes y no las tocó ninguna migración: `doc_normalizado`
  difiere en un comentario, los dos triggers de asignación (`trg_notif_siniestro`
  y `trg_notif_pendiente`) avisan solo al asignado en las dos bases, y
  producción tiene `despachar_emails` y `generar_avisos_vencimientos`, que test
  no tiene a propósito.
- Simulando el token de un organizador: ve sus 37 siniestros, 19 fichas, 203
  movimientos de facturación, 49 renovaciones, 17 denuncias, 8 objetivos, 12
  pendientes, su equipo de 6 y los seis módulos del plan Full. Sin sesión, nada.
- Por el camino real del formulario público (cliente anónimo con la clave
  `anon`): la denuncia y la cotización entran y quedan a nombre de Saraceni,
  leer devuelve vacío y no se puede cargar a una empresa inventada. Las 25 filas
  de prueba se borraron con sus notificaciones y los totales volvieron exactos.

⚠️ **El primer insert anónimo después de aplicar una migración puede fallar con
42501 aunque la policy esté bien.** Pasó en test y en producción: PostgREST
recarga su caché de esquema y el primer pedido cae. El mismo cuerpo, repetido,
entró 3 de 3. Antes de salir a buscar un bug en las policies, reintentar.

⚠️ La 0017 se aplicó **antes** de desplegar el código, no después como decía el
paso 6: así `org_publica` ya devuelve `modulos` cuando cargan las páginas
nuevas. El riesgo que describía ese paso —ver el error crudo de la policy en vez
del aviso— no existe con una sola empresa, que tiene todos los módulos. Igual se
corrigió el código para que un `modulos` que no viene no cierre el formulario.

## El email de los avisos (0020)

La campanita del portal funciona desde julio. El **email nunca salió**: las 294
notificaciones de producción están en `email_estado = 'omitido'`, que es lo que
marca la Edge Function cuando no encuentra `RESEND_API_KEY`.

Lo que hay montado, y dónde vive cada pieza:

| Pieza | Dónde | Estado |
|---|---|---|
| Trigger `notif_solicitud_nueva` | base | anda: 36 avisos de denuncia web |
| Tabla `notificaciones` | base | anda |
| Cron `despacho-emails` | pg_cron, **solo producción** | anda, cada minuto desde la 0020 |
| Edge Function `enviar-notificaciones` | Supabase + `supabase/functions/` | desplegada en las dos |
| `RESEND_API_KEY` | secret de la función | **falta: es lo único que falta** |

⚠️ **La Edge Function se despliega aparte.** No la toca ni `git push` ni Vercel:
el archivo del repo es la copia de referencia, y para que cambie lo que corre
hay que subirla a Supabase. Antes de la 0020 el único ejemplar del código estaba
adentro de Supabase y no había copia en ningún lado.

### La diferencia de esquema que apareció probando

`notificaciones.usuario_id` apuntaba a `perfiles` en producción y a `auth.users`
en test. PostgREST arma sus `select` anidados leyendo las claves foráneas, así
que el mismo código contestaba bien en producción y en test tiraba
*"Could not find a relationship between 'notificaciones' and 'perfiles'"*.

Es la peor clase de diferencia: lo que se prueba no es lo que corre. La 0020 deja
las dos iguales (apuntando a `perfiles`, que es lo que dice
`roles_notificaciones.sql`). **Al comparar las bases, mirar también las claves
foráneas**, no solo columnas y policies.

### Por qué la 0020 no corre con apuro a producción

El 2026-10-02 se descartó el aviso por mail: el asegurado recibe el link cuando
avisa el siniestro, así que el broker ya sabe que va a entrar. De las dos cosas
que hace la 0020, en producción una **no cambia nada** (la clave foránea de
`notificaciones` ya apunta a `perfiles`; la que estaba mal era test) y la otra
—despachar cada minuto en vez de cada diez— solo importa si algún día se
conecta un proveedor de email.

Se aplica igual cuando toque, para que las dos bases queden con el mismo
historial. No es un pendiente que trabe una entrega.
