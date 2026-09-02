# Portal Saraceni — guía para trabajar en este repo

Portal de gestión interna de **Saraceni Broker de Seguros** (siniestros,
renovaciones, facturación, pendientes, objetivos y comercial), más dos páginas
públicas para que los clientes carguen denuncias y pidan cotizaciones.

> ⚠️ **El repositorio es público.** Nunca commitear contraseñas, claves de API
> ni datos personales de clientes. La `anon key` de Supabase sí va versionada
> (es pública por diseño y está protegida por RLS); la `service_role` jamás.

---

## Stack: sin build, sin Node

No hay `npm`, ni bundler, ni paso de compilación. `index.html` carga React y
Babel Standalone desde CDN y todos los `.jsx` se transpilan **en el navegador**:

```html
<script type="text/babel" src="ui.jsx"></script>
```

Consecuencias prácticas:

- **No hay imports/exports.** Cada archivo declara funciones en el scope global
  y al final hace `Object.assign(window, { ... })` con lo que expone.
- **El orden de carga en `index.html` importa.** Un archivo solo puede usar lo
  que ya cargó antes. Orden actual:
  `config.js → db.js → data.jsx → auth.jsx → ui.jsx → charts.jsx →
  estadisticas.jsx → objetivos-datos.jsx → objetivos-form.jsx → modals.jsx → detail.jsx → solicitudes.jsx → usuarios.jsx →
  facturas.jsx → renovaciones.jsx → comercial.jsx → pendientes.jsx →
  objetivos.jsx → calendar.jsx → app.jsx`
- **Todos los archivos comparten un mismo scope global.** Dos `const` de nivel
  superior con el mismo nombre en archivos distintos rompen todo con
  "Identifier has already been declared": los nombres nuevos van prefijados
  (`CH_`, `est`, `obj`, `fact`).
- **Cuidado con el orden dentro de un archivo**: las `function` se hoistean pero
  las `var`/`const` no. Si una función se *ejecuta* arriba y usa un `var`
  declarado abajo, recibe `undefined` (ya pasó dos veces).
- Al agregar un archivo nuevo hay que sumarlo al `index.html`.

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | HTML raíz + **todo el CSS** del portal + carga de scripts |
| `config.js` | URL y anon key de Supabase |
| `db.js` | Única capa de datos. Todo Supabase pasa por acá |
| `data.jsx` | Constantes de negocio (ramos, compañías, estados) y helpers de fecha |
| `ui.jsx` | Íconos, sidebar, topbar, tabla de siniestros, agenda, **menú de navegación** |
| `charts.jsx` | Gráficos en SVG hechos a mano (barras, dona, anillo, barras horizontales). No hay librería de gráficos: se dibujan acá y miden el ancho del contenedor para que el texto del eje no escale |
| `estadisticas.jsx` | Estadísticas de siniestros: demora promedio por ramo, por hecho y el cruce entre los dos |
| `objetivos-datos.jsx` | Objetivos: áreas, períodos y cálculo del avance. Sin interfaz |
| `objetivos-form.jsx` | Objetivos: asistente de 5 pasos para crear o editar |
| `app.jsx` | Orquestador: sesión, perfil/rol, ruteo por `active`, estado global |
| `auth.jsx` | Login, registro y pantalla de "cuenta pendiente" |
| `modals.jsx` / `detail.jsx` | Alta/edición y ficha completa de siniestro (+ PDF) |
| `solicitudes.jsx` `facturas.jsx` `renovaciones.jsx` `comercial.jsx` `pendientes.jsx` `objetivos.jsx` `usuarios.jsx` | Un módulo por carpeta del menú |
| `denuncia.html` / `cotizar-hogar.html` | Páginas **públicas** standalone (no cargan el portal) |
| `supabase/*.sql` | Esquema de referencia de cada tabla (documentación, no se ejecuta solo) |

## Patrón para agregar un módulo

1. **Tabla + RLS** en Supabase (ver más abajo) y dejarla documentada en `supabase/`.
2. **`db.js`**: un namespace con `list/create/update/remove/subscribe` y el mapeo
   `snake_case` (Postgres) ↔ `camelCase` (app). Los helpers `orNull` y
   `numOrNull` viven arriba, fuera de los módulos: **no duplicarlos ni moverlos
   adentro de un bloque**.
3. **`<modulo>.jsx`**: componentes + un orquestador `XModule({ active, station, query })`.
4. **`ui.jsx`**: entrada en `PORTAL_NAV` y su constante `X_KEYS`.
   `org: true` en la carpeta = solo organizadores.
5. **`app.jsx`**: ruteo en la cascada de `active`.
6. **`index.html`**: `<script type="text/babel" src="...">` + su CSS.

## Roles y seguridad (RLS)

Dos roles, en la tabla `perfiles`: **organizador** y **empleado**. Toda cuenta
nueva nace `estado='pendiente'` y no ve nada hasta que un organizador la aprueba.

- Helpers en Postgres: `public.es_activo()` y `public.es_organizador()`.
- **Operativo** (siniestros, solicitudes, pendientes, renovaciones, cotizaciones):
  select/insert/update para cualquier activo; `delete` solo organizador.
- **Administrativo** (facturación, objetivos, usuarios): todo solo organizador.
- Las páginas públicas insertan como `anon` y **nunca** pueden leer:
  `for insert to anon with check (true)` y ninguna policy de select.

> Al crear policies por comando (`select`/`insert`/`update`/`delete`) es fácil
> olvidarse una. Ya pasó: `solicitudes` quedó sin `insert` para `authenticated`
> y un usuario logueado no podía enviar una denuncia. **Si reemplazás un
> `for all`, cubrí los cuatro comandos.**

Verificar siempre con `curl` que `anon` no lee lo que no debe.

## Tiempo real

`db.js` expone `subscribe()` por módulo. **Si dos componentes escuchan la misma
tabla, el nombre del canal debe ser único** o Supabase rechaza la segunda
suscripción y el módulo crashea:

```js
c.channel("cotizaciones-realtime-" + Math.random().toString(36).slice(2, 8))
```

## Despliegue

- `test` → preview en Vercel (protegido, requiere link temporal para verlo).
- `main` → producción: https://siniestros-saraceni.vercel.app
- Push a la rama = deploy automático. No hay build step.
- **Trabajar siempre en `test`.** Pasar a producción solo cuando lo piden, con
  `git checkout main && git merge test && git push origin main`.
- `vercel.json` tiene `cleanUrls`, por eso `/denuncia` sirve `denuncia.html`.

⚠️ **Hay una sola base de datos para test y producción.** Cualquier migración
impacta en los dos ambientes al instante; el código es lo único que queda
aislado por rama. Tenerlo en cuenta antes de un `alter table` o un `delete`.

## Convenciones

- Todo en **castellano rioplatense**: interfaz, nombres de variables de negocio,
  comentarios y mensajes de commit (sin tildes en los commits).
- Los comentarios explican **por qué**, no qué hace la línea.
- Los importes se guardan como `numeric` y se formatean con `toLocaleString("es-AR")`.
- Fechas en `YYYY-MM-DD` (columnas `date`), y se muestran con los helpers de `data.jsx`.
- Antes de dar algo por terminado: **probarlo en el navegador**, no solo leer el
  código. Varios bugs (canal duplicado, orden de declaración, función borrada,
  policy faltante) solo aparecieron al usar la pantalla de verdad.

## Datos que vienen de Excel

Hernán trabaja con planillas propias y las pasa para importar. No hay Python ni
pandas en su máquina: se leen con **PowerShell + Excel COM**.

- Usar `.Value2` y no `.Text` (si no, las fechas salen `#####` y los CUIT en
  notación científica).
- **No asumir en qué fila arrancan los datos**: buscar la fila cuyo encabezado
  empieza con "FECHA". Las hojas de un mismo archivo pueden diferir, y por eso
  se perdieron 7 meses de una compañía en una importación.
- Las fechas vienen como serial de Excel: `date '1899-12-30' + serial`.
- Contrastar siempre los totales importados contra la planilla antes de dar por
  buena la carga.
