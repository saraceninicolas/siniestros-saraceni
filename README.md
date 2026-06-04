# Saraceni Seguros · Portal de Siniestros

Portal interno para el **seguimiento de gestiones de siniestros** de Saraceni
(broker de seguros). Permite registrar siniestros, ver una agenda de gestiones
por fecha límite, marcar recordatorios en Google Calendar y llevar el estado de
cada caso.

- **Panel de control** — KPIs (activos, por vencer, vencidas, terminados) + tabla.
- **Siniestros** — listado completo con búsqueda en vivo y filtros (estado / ramo / compañía).
- **Agenda de gestiones** — worklist agrupada por urgencia + integración Google Calendar / `.ics`.
- **Detalle** — pantalla completa por siniestro con editar / eliminar.

Marca roja `#DD0909`, tipografía Public Sans. Diseñado en Claude Design.

---

## 🧱 Cómo está hecho (sin compilación)

Es un **sitio estático**: React + Babel corren directamente en el navegador, así
que **no necesita Node.js ni un paso de build**. Se despliega tal cual en Vercel.

| Archivo | Qué hace |
|---|---|
| `index.html` | Página principal + todos los estilos CSS |
| `data.jsx` | Modelo de datos, constantes y datos de ejemplo (seed) |
| `ui.jsx` | Componentes de UI (sidebar, topbar, KPIs, tabla, agenda) |
| `modals.jsx` | Modales de alta / edición / detalle / confirmación |
| `detail.jsx` | Pantalla completa de detalle |
| `calendar.jsx` | Integración Google Calendar y exportación `.ics` |
| `tweaks-panel.jsx` | Panel de ajustes de tema (opcional) |
| `app.jsx` | Lógica principal + conexión con Supabase |
| `config.js` | **Tus claves de Supabase** (las cargás vos) |
| `db.js` | Acceso a datos sobre Supabase |
| `supabase/schema.sql` | Crea la tabla y carga los datos iniciales |

> **Modo demo:** si `config.js` está vacío, el portal arranca con los datos de
> ejemplo del Excel (no guarda nada). Apenas cargás las claves de Supabase y
> recargás, pasa a **guardar todo en la base**.

---

## 🚀 Puesta en marcha (3 pasos)

El orden recomendado es: **1) Supabase → 2) GitHub → 3) Vercel**.

### 1) Supabase (base de datos)

1. Entrá a <https://supabase.com> y creá una cuenta (botón **Start your project**).
2. **New project** → ponele un nombre (ej. `siniestros-saraceni`), elegí una
   contraseña de base de datos y la región más cercana (ej. *São Paulo*). Esperá
   ~1 minuto a que se cree.
3. En el menú izquierdo, **SQL Editor → New query**. Abrí el archivo
   [`supabase/schema.sql`](supabase/schema.sql) de este repo, **copiá todo su
   contenido**, pegalo y presioná **Run**. Eso crea la tabla `siniestros` y carga
   los 12 siniestros reales.
4. Ahora copiá tus credenciales: **Settings → API**.
   - **Project URL** → algo como `https://abcdxyz.supabase.co`
   - **Project API keys → `anon` `public`** → una clave larga que empieza con `eyJ...`
5. Pegá esos dos valores en [`config.js`](config.js):
   ```js
   window.SUPABASE_URL = "https://abcdxyz.supabase.co";
   window.SUPABASE_ANON_KEY = "eyJ...tu-clave-anon...";
   ```
   > La clave `anon` es **pública** (va en el navegador): es seguro versionarla.
   > **No** pegues acá la `service_role` (esa es secreta).

### 2) GitHub (repositorio)

El repo ya está inicializado localmente con un commit. Para subirlo:

1. Entrá a <https://github.com> e iniciá sesión.
2. Arriba a la derecha **+ → New repository**. Nombre: `siniestros-saraceni`.
   Dejalo **Private** si querés. **No** marques "Add a README" (ya tenemos uno).
   **Create repository**.
3. GitHub te muestra una URL. Conectá y subí desde tu PC (PowerShell, en la
   carpeta del proyecto):
   ```powershell
   git remote add origin https://github.com/TU_USUARIO/siniestros-saraceni.git
   git branch -M main
   git push -u origin main
   ```
   Te va a pedir iniciar sesión en GitHub la primera vez.

### 3) Vercel (publicación)

1. Entrá a <https://vercel.com> y **Sign up con GitHub** (así Vercel ve tus repos).
2. **Add New… → Project** → elegí el repo `siniestros-saraceni` → **Import**.
3. No hace falta configurar nada: es un sitio estático. Dejá todo por defecto y
   **Deploy**.
4. En ~30 segundos tenés una URL pública (ej. `https://siniestros-saraceni.vercel.app`).
   Cada vez que hagas `git push`, Vercel actualiza el sitio solo.

¡Listo! El portal queda online y guardando en Supabase.

---

## 🔒 Seguridad (importante)

El portal está pensado **sin login** (puesto compartido en la oficina) y usa la
clave pública `anon`. Eso significa que **cualquiera que tenga la URL podría ver
o editar los datos**. Para uso real, recomiendo una de estas opciones:

- **Proteger el sitio con contraseña** en Vercel
  (Project → Settings → **Deployment Protection / Password Protection**). Es lo
  más simple. *(Requiere plan Pro de Vercel.)*
- **Agregar login** con Supabase Auth y restringir las políticas RLS a usuarios
  autenticados. Es más trabajo pero es la opción más robusta. Avisame y lo armamos.

Mientras tanto, mantené la URL privada (no la publiques).

---

## 🖥️ Probar en tu PC (opcional)

Como los archivos `.jsx` se cargan por separado, **no** alcanza con abrir
`index.html` haciendo doble clic (el navegador lo bloquea por `file://`). Tenés
que servirlo por HTTP. Opciones:

- **VS Code** → instalá la extensión *Live Server* → clic derecho sobre
  `index.html` → *Open with Live Server*.
- O, si tenés Python: en la carpeta del proyecto, `python -m http.server 5500` y
  abrí <http://localhost:5500>.

(De todos modos, la forma más cómoda de verlo es directamente en la URL de Vercel.)

---

## ✏️ Editar los datos

Una vez conectado Supabase, todo se edita **desde el propio portal** (botón
*Registrar siniestro*, *Editar*, *Eliminar*). También podés ver/editar la tabla
directamente en Supabase → **Table Editor → siniestros**.
