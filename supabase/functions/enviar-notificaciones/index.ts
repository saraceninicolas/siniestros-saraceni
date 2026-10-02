// enviar-notificaciones — Pasa a email los avisos que el portal ya generó.
// ─────────────────────────────────────────────────────────────────────────────
// El portal avisa por dos vías, y son independientes a propósito:
//
//   1. La campanita del topbar, que escribe un trigger en `notificaciones`.
//      Esa funciona siempre, sin depender de nadie de afuera.
//   2. El email, que es esta función: toma las notificaciones con el email
//      todavía `pendiente` y las manda. La llama pg_cron cada minuto
//      (`public.despachar_emails`), así una denuncia nueva se avisa enseguida.
//
// Si el email falla —o no hay proveedor configurado— la campanita ya quedó
// hecha: nunca se pierde el aviso, se pierde el recordatorio.
//
// ⚠️ Este archivo está versionado acá pero CORRE en Supabase. Editarlo no
// cambia nada hasta desplegarlo (Edge Functions → enviar-notificaciones).
//
// Secrets: RESEND_API_KEY (sin ella no sale ningún mail), y EMAIL_FROM y
// PORTAL_URL, los dos opcionales.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// El nombre del asegurado viaja desde un formulario PÚBLICO hasta el título del
// aviso, y de ahí al HTML de este mail. Cualquiera puede escribir lo que quiera
// en ese campo: sin escapar, un "<" de más rompe el mail, y uno bien puesto
// mete etiquetas ajenas adentro de nuestro cuerpo.
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// El color sale de la marca que el broker eligió en Ajustes y termina adentro
// de un atributo `style`. Se acepta solo lo que de verdad es un color.
const color = (c: unknown, porDefecto = "#111827") =>
  /^#[0-9a-f]{3,8}$/i.test(String(c ?? "")) ? String(c) : porDefecto;

// Qué letra va ENCIMA del relleno de marca. Es `tintaSobre()` de marca.js,
// repetida acá porque un mail no tiene las variables CSS del portal: viaja
// como HTML suelto al correo de cada uno y los colores van escritos.
//
// No es un detalle: el botón salía siempre blanco sobre el color del broker, y
// con el amarillo de Aicardi (#FED403) "Abrir el portal" quedaba invisible. Es
// la misma trampa que el portal ya había resuelto en la pantalla.
function tinta(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const canal = (i: number) => {
    const v = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  // Luminancia relativa WCAG: el verde pesa mucho más que el azul.
  const luz = 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
  return luz > 0.45 ? "#191C22" : "#FFFFFF";
}

// A qué portal mandamos al que recibe el mail. Se deduce de la base a la que
// está conectada esta función, con la misma regla cerrada que usa config.js en
// el navegador: solo el proyecto de producción apunta al sitio real y cualquier
// otro cae en test. Así una copia de esta función no manda a nadie al portal
// equivocado por olvidarse de configurar una variable.
function portalBase() {
  const propio = Deno.env.get("PORTAL_URL");
  if (propio) return propio.replace(/\/+$/, "");
  const url = Deno.env.get("SUPABASE_URL") || "";
  return url.includes("yscvpdogjgfvllizbyxp")
    ? "https://siniestros-saraceni.vercel.app"
    : "https://siniestros-saraceni-test.vercel.app";
}

// Una denuncia que entra por la web no es lo mismo que un recordatorio de
// vencimiento: la primera tiene a alguien del otro lado esperando respuesta.
const ACLARACION: Record<string, string> = {
  solicitud: "Entró por el formulario web, con el asegurado esperando respuesta.",
};

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
  const FROM = Deno.env.get("EMAIL_FROM") || "Portal de gestiones <onboarding@resend.dev>";

  const { data: pend, error } = await supabase
    .from("notificaciones")
    .select("id, usuario_id, tipo, titulo, cuerpo, referencia, created_at, perfiles(email, nombre, estado)")
    .eq("email_estado", "pendiente")
    .order("id", { ascending: true })
    .limit(30);
  if (error) return json({ error: error.message }, 500);
  if (!pend || !pend.length) return json({ enviados: 0, pendientes: 0 });

  // Sin proveedor de email: quedan solo in-app, no se acumulan
  if (!RESEND_KEY) {
    const ids = pend.map((n) => n.id);
    await supabase.from("notificaciones").update({ email_estado: "omitido" }).in("id", ids);
    return json({ enviados: 0, omitidos: ids.length, motivo: "RESEND_API_KEY no configurada" });
  }

  // De qué empresa es cada destinatario. El mail sale con el nombre y el color
  // de SU broker: `notificaciones` no tiene org_id porque el dueño del aviso ya
  // dice de quién es, así que la empresa se resuelve por la membresía. Un mail
  // de Aicardi firmado "Portal Saraceni" le estaría contando a su equipo con
  // qué sistema trabajan, y encima con la marca de otro.
  const marcaDe = new Map<string, { nombre: string; slug: string; color: string }>();
  const { data: mem } = await supabase
    .from("membresias")
    .select("usuario_id, organizaciones(nombre, slug, marca)")
    .in("usuario_id", [...new Set(pend.map((n) => n.usuario_id))])
    .eq("estado", "activo");
  for (const m of mem || []) {
    const o = m.organizaciones as { nombre?: string; slug?: string; marca?: Record<string, unknown> } | null;
    if (!o) continue;
    marcaDe.set(m.usuario_id as string, {
      nombre: o.nombre || "Portal de gestiones",
      slug: o.slug || "",
      color: color(o.marca?.color),
    });
  }

  let enviados = 0, errores = 0, omitidos = 0;
  for (const n of pend) {
    const perfil = n.perfiles as { email?: string; nombre?: string; estado?: string } | null;
    if (!perfil?.email || perfil.estado !== "activo") {
      await supabase.from("notificaciones").update({ email_estado: "omitido" }).eq("id", n.id);
      omitidos++;
      continue;
    }
    const org = marcaDe.get(n.usuario_id as string) ||
      { nombre: "Portal de gestiones", slug: "", color: "#111827" };
    const link = portalBase() + (org.slug ? "/" + org.slug : "");
    const aclaracion = ACLARACION[n.tipo as string];

    let estado = "error";
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [perfil.email],
          subject: `[${org.nombre}] ${n.titulo}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;color:#333">
            <div style="border-top:4px solid ${org.color};padding-top:14px">
              <h2 style="margin:0 0 6px;font-size:19px;color:#111827">${esc(n.titulo)}</h2>
              ${n.cuerpo ? `<p style="margin:0 0 10px">${esc(n.cuerpo)}</p>` : ""}
              ${aclaracion ? `<p style="margin:0 0 10px;color:#555">${aclaracion}</p>` : ""}
              ${n.referencia ? `<p style="margin:0 0 16px;font-size:13px;color:#666">Referencia: <b>${esc(n.referencia)}</b></p>` : ""}
              <a href="${esc(link)}" style="display:inline-block;background:${org.color};color:${tinta(org.color)};
                 text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px">Abrir el portal</a>
              <p style="color:#999;font-size:12px;margin-top:20px">
                Este aviso también está en la campanita del portal · ${esc(org.nombre)}</p>
            </div>
          </div>`,
        }),
      });
      estado = r.ok ? "enviado" : "error";
      // Un 'error' en la tabla no dice por qué. Resend contesta el motivo
      // (dominio sin verificar, destinatario no permitido, clave vencida) y es
      // justo lo que hace falta para arreglarlo: queda en los logs de la función.
      if (!r.ok) console.error("resend", r.status, await r.text().catch(() => ""));
    } catch (e) {
      console.error("resend excepcion", String(e));
      estado = "error";
    }
    await supabase.from("notificaciones").update({ email_estado: estado }).eq("id", n.id);
    if (estado === "enviado") enviados++; else errores++;
  }
  return json({ enviados, errores, omitidos });
});
