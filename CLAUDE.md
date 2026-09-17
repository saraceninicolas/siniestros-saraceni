# Portal Saraceni — guía para trabajar en este repo

Portal de gestión interna de **Saraceni Broker de Seguros** (siniestros,
renovaciones, facturación, pendientes, objetivos y comercial), más dos páginas
públicas para que los clientes carguen denuncias y pidan cotizaciones.

> ⚠️ **El repositorio es público.** Nunca commitear contraseñas, claves de API
> ni datos personales de clientes. La `anon key` de Supabase sí va versionada
> (es pública por diseño y está protegida por RLS); la `service_role` jamás.

---

## Stack: Vite + React (migración a medio camino)

```bash
npm install     # una vez
npm run dev     # servidor local en :5173, con recarga en caliente
npm run build   # compila a dist/
npm run preview # sirve dist/ en :4173, para probar lo compilado
npm test        # tests (vitest)
```

⚠️ **La migración a módulos ES está en el PASO 1 de 2.** Leer `src/main.jsx`
antes de tocar nada: explica el plan completo.

- **Paso 1 (actual):** Vite compila y empaqueta, pero los módulos se siguen
  hablando por `window` como antes. `src/andamio.js` pone React y Supabase en
  `window`; `src/main.jsx` importa los módulos en el mismo orden que tenían los
  viejos `<script>`.
- **Paso 2 (pendiente):** pasar archivo por archivo a `import`/`export` de
  verdad, con el portal andando en todo momento. Ahí se borran el andamio, los
  `Object.assign(window, …)` y los `export {};` del final de cada `.jsx`.

Mientras dure el paso 1 siguen valiendo las reglas viejas:

- **Todos los archivos comparten el scope global.** Dos `const` de nivel
  superior con el mismo nombre rompen todo con "Identifier has already been
  declared": los nombres nuevos van prefijados (`CH_`, `est`, `obj`, `fact`).
- **El orden de los imports en `src/main.jsx` importa.** Un archivo solo puede
  usar lo que ya se evaluó antes. Al agregar un archivo nuevo hay que sumarlo
  ahí, no a `index.html`.
- **Cada `.jsx` termina con `export {};`.** No es decorativo: el compilador
  decide si un archivo es módulo ES o script mirando si tiene algún
  `import`/`export`. Sin eso lo toma por script y compila el JSX a `require()`,
  que en el navegador no existe.
- **Cuidado con el orden dentro de un archivo**: las `function` se hoistean pero
  las `var`/`const` no. Si una función se *ejecuta* arriba y usa un `var`
  declarado abajo, recibe `undefined` (ya pasó dos veces).
- **Los `import` de ES se hoistean**: se evalúan antes que cualquier línea del
  cuerpo del archivo que los importa. Por eso el andamio vive en su propio
  archivo y no dentro de `main.jsx`.

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | HTML raíz. Ya NO tiene el CSS ni la lista de scripts: solo carga `src/main.jsx` |
| `vite.config.js` | Build. Tres entradas: el portal y las dos páginas públicas |
| `src/main.jsx` | **Punto de entrada.** Importa los módulos en orden. Explica la migración |
| `src/andamio.js` | Temporal: pone React y Supabase en `window` (paso 1) |
| `src/publico.js` | Entrada de las dos páginas públicas |
| `src/estilos/tokens.css` | **Las variables de diseño.** Acá vive todo lo que cambia entre una marca y otra |
| `src/estilos/portal.css` | El resto del CSS del portal |
| `src/config.js` | Elige **a qué base** se conecta el portal, según el dominio |
| `src/imagenes.js` | Achica las fotos antes de subirlas (1600px, WebP). Ante cualquier problema devuelve el original: optimizar nunca puede hacer fallar una carga |
| `src/db.js` | Única capa de datos. Todo Supabase pasa por acá |
| `src/data.jsx` | Constantes de negocio (ramos, compañías, estados) y helpers de fecha |
| `src/ui.jsx` | Íconos, sidebar, topbar, tabla de siniestros, agenda, **menú de navegación** |
| `src/charts.jsx` | Gráficos en SVG hechos a mano (barras, dona, anillo, barras horizontales). No hay librería de gráficos: se dibujan acá y miden el ancho del contenedor para que el texto del eje no escale |
| `src/estadisticas.jsx` | Estadísticas de siniestros: demora promedio por ramo, por hecho y el cruce entre los dos |
| `src/objetivos-datos.jsx` | Objetivos: áreas, períodos y cálculo del avance. Sin interfaz |
| `src/objetivos-form.jsx` | Objetivos: asistente de 5 pasos para crear o editar |
| `src/app.jsx` | Orquestador: sesión, perfil/rol, ruteo por `active`, estado global |
| `src/auth.jsx` | Login, registro y pantalla de "cuenta pendiente" |
| `src/asegurados.jsx` | Buscador de asegurado con autocompletado por documento o nombre |
| `src/duplicados.jsx` | Revisión y unificación de asegurados duplicados (solo organizador) |
| `src/adjuntos.jsx` | Grilla de adjuntos, visor de fotos y descarga en zip |
| `src/modals.jsx` / `src/detail.jsx` | Alta/edición y ficha completa de siniestro (+ PDF) |
| `src/solicitudes.jsx` `src/facturas.jsx` `src/renovaciones.jsx` `src/comercial.jsx` `src/pendientes.jsx` `src/objetivos.jsx` `src/usuarios.jsx` | Un módulo por carpeta del menú |
| `denuncia.html` / `cotizar-hogar.html` | Páginas **públicas** standalone (no cargan el portal) |
| `supabase/*.sql` | Esquema de referencia de cada tabla (documentación, no se ejecuta solo) |
| `supabase/migrations/` | **Historial** de cambios de esquema. Archivos numerados que no se editan una vez aplicados. El README dice qué migración está en cada ambiente |

## Patrón para agregar un módulo

1. **Tabla + RLS** en Supabase y una migración en `supabase/migrations/`.
2. **`src/db.js`**: un namespace con `list/create/update/remove/subscribe` y el
   mapeo `snake_case` (Postgres) ↔ `camelCase` (app). Los helpers `orNull` y
   `numOrNull` viven arriba, fuera de los módulos: **no duplicarlos ni moverlos
   adentro de un bloque**.
3. **`src/<modulo>.jsx`**: componentes + un orquestador
   `XModule({ active, station, query })`. Termina con `Object.assign(window, …)`
   y `export {};` (mientras dure el paso 1 de la migración).
4. **`src/ui.jsx`**: entrada en `PORTAL_NAV` y su constante `X_KEYS`.
   `org: true` en la carpeta = solo organizadores.
5. **`src/app.jsx`**: ruteo en la cascada de `active`.
6. **`src/main.jsx`**: el `import` en la posición correcta del orden.
7. **`src/estilos/portal.css`**: su CSS. Si agrega un color, va en `tokens.css`.

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

Cada rama tiene su **proyecto de Vercel y su base de Supabase**, separados:

| Rama | Sitio | Base de datos |
|---|---|---|
| `test` | https://siniestros-saraceni-test.vercel.app | `ykqnthxwawmoadvoywgl` (datos inventados) |
| `main` | https://siniestros-saraceni.vercel.app | `yscvpdogjgfvllizbyxp` (datos reales) |

- Push a la rama = deploy automático. **Vercel corre `npm run build`** y publica
  `dist/` (configurado en `vercel.json`).
- **Trabajar siempre en `test`.** Pasar a producción solo cuando lo piden, con
  `git checkout main && git merge test && git push origin main`.
- `vercel.json` tiene `cleanUrls`, por eso `/denuncia` sirve `denuncia.html`.
- **Vercel ignora las rutas que empiezan con `_`**: un archivo `_algo.html` da
  404 por más que esté desplegado.

**Qué base usa cada sitio lo decide `config.js` por el dominio**, no una
variable de entorno: sin build no hay quién las inyecte. La regla es
deliberadamente cerrada —solo el dominio exacto de producción usa la base
real, todo lo demás cae en test— así que una URL nueva que nadie previó
escribe en test, nunca al revés.

⚠️ **Las migraciones ya no impactan en los dos ambientes.** Van primero a test,
se verifican, y recién después a producción. El estado de cada una se anota en
`supabase/migrations/README.md`. Antes de un `alter table` o un `delete` en la
base real, preguntar.

## Convenciones

- Todo en **castellano rioplatense**: interfaz, nombres de variables de negocio,
  comentarios y mensajes de commit (sin tildes en los commits).
- Los comentarios explican **por qué**, no qué hace la línea.
- Los importes se guardan como `numeric` y se formatean con `toLocaleString("es-AR")`.
- Fechas en `YYYY-MM-DD` (columnas `date`), y se muestran con los helpers de `data.jsx`.
- Antes de dar algo por terminado: **probarlo en el navegador**, no solo leer el
  código. Varios bugs (canal duplicado, orden de declaración, función borrada,
  policy faltante, un `revoke` que no revocaba) solo aparecieron al usar la
  pantalla de verdad o al consultar la base.
- **Ahora sí hay servidor local**: `npm run dev` (:5173). Ya no hace falta
  desplegar en test para probar. Igual conviene verificar lo **compilado** antes
  de dar algo por bueno —`npm run build && npm run preview` (:4173)—, porque el
  servidor de desarrollo y la build no son idénticos.
- La máquina no tiene Python: el `python` del PATH es el stub de la Microsoft
  Store. Para scripts sueltos, usar Node.
- El panel de vista previa del navegador no ejecuta JS sobre `file://` (lo carga
  como `data:`): probar contra `localhost`, no abriendo el archivo.

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
