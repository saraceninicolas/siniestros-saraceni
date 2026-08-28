# Saraceni Seguros · Portal de gestiones

Portal interno de **Saraceni Broker de Seguros**. Arrancó como seguimiento de
siniestros y hoy cubre la operación diaria del estudio, más dos páginas públicas
para que los clientes carguen denuncias y pidan cotizaciones sin llamar por
teléfono.

🔗 **Producción:** https://siniestros-saraceni.vercel.app

Marca roja `#DD0909`, tipografía Public Sans.

---

## Qué incluye

| Carpeta | Para qué sirve |
|---|---|
| **Objetivos** | Metas del estudio con barra de avance (las de facturación se calculan solas) |
| **Siniestros** | Panel con KPIs, agenda de gestiones por vencimiento, historial editable por caso, adjuntos, exportación de la ficha a PDF y sincronización con Google Calendar |
| **Facturación** | Carga mensual por compañía y matriz de crecimiento anual |
| **Comercial** | Pedidos de cotización de hogar que llegan del link público |
| **Renovaciones** | Pólizas próximas a vencer e historial |
| **Pendientes** | Tareas del estudio por prioridad y vencimiento |
| **Administración** | Usuarios, roles y aprobación de cuentas nuevas |

### Páginas públicas (sin login)

- **`/denuncia`** — el asegurado carga su siniestro. Elige ramo y qué pasó, y el
  formulario le pide **las fotos que corresponden a ese caso** (para un choque:
  registro, cédula verde y daños de ambos; para robo de ruedas: denuncia
  policial, la rueda colocada y cómo quedó el auto). Entra al portal al instante,
  en *Siniestros → Solicitudes recibidas*, y se convierte en siniestro con un clic.
- **`/cotizar-hogar`** — pedido de cotización de seguro de hogar. Llega a
  *Comercial → Cotizaciones de hogar*.

Quien completa esos formularios **solo puede enviar**: no puede leer ninguna
información del portal ni de otras solicitudes.

---

## Accesos y roles

Se entra con **email y contraseña**. Hay dos roles:

- **Organizador** — ve y administra todo, incluidas Facturación, Objetivos y la
  gestión de usuarios.
- **Empleado** — trabaja Siniestros, Renovaciones, Pendientes y Comercial.

Cualquiera puede registrarse desde la pantalla de acceso, pero la cuenta queda
**pendiente** y no ve nada hasta que un organizador la aprueba en
*Administración → Usuarios y roles*.

> Las credenciales no están en este repositorio. Pedíselas al administrador.

---

## Cómo está hecho

Es un **sitio estático**: React y Babel corren en el navegador, así que no hay
Node, ni dependencias, ni paso de compilación. Se despliega tal cual en Vercel y
guarda todo en Supabase (base de datos, login, archivos y avisos en tiempo real).

| Archivo | Qué hace |
|---|---|
| `index.html` | Página principal y todos los estilos |
| `config.js` | Claves públicas de Supabase |
| `db.js` | Único punto de acceso a la base |
| `data.jsx` | Constantes de negocio y utilidades de fecha |
| `ui.jsx` | Menú, barra superior, tablas y componentes comunes |
| `app.jsx` | Sesión, permisos y navegación |
| `auth.jsx` | Ingreso, registro y cuenta pendiente |
| `modals.jsx`, `detail.jsx` | Alta/edición y ficha del siniestro |
| `solicitudes.jsx`, `facturas.jsx`, `comercial.jsx`, `renovaciones.jsx`, `pendientes.jsx`, `objetivos.jsx`, `usuarios.jsx` | Un archivo por carpeta del menú |
| `denuncia.html`, `cotizar-hogar.html` | Las dos páginas públicas |
| `supabase/*.sql` | Esquema de cada tabla, como referencia |

Si vas a modificar el código, leé primero [`CLAUDE.md`](CLAUDE.md): explica las
convenciones del proyecto y varias trampas conocidas.

---

## Publicación

- Rama **`test`** → preview privado en Vercel, para probar antes de publicar.
- Rama **`main`** → producción.

Cada `git push` actualiza el sitio automáticamente. El trabajo se hace siempre
en `test`, y pasa a producción con un merge cuando está aprobado.

⚠️ **Ambos ambientes comparten la misma base de datos.** Un cambio de estructura
o un borrado impacta en los dos al instante.

---

## Probarlo en tu PC

Los archivos `.jsx` se cargan por separado, así que no alcanza con abrir
`index.html` haciendo doble clic. Hay que servirlo por HTTP:

- **VS Code** → extensión *Live Server* → clic derecho en `index.html` →
  *Open with Live Server*.
- O con Python: `python -m http.server 5500` y entrar a http://localhost:5500

De todos modos, lo más cómodo es usar directamente la URL de Vercel.
