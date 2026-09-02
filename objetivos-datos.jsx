// objetivos-datos.jsx — Áreas, períodos y cálculo de avance de los objetivos
// ─────────────────────────────────────────────────────────────────────────────
// Acá vive todo lo que NO es interfaz: qué áreas existen, cómo se arma un
// período, de dónde sale el avance de cada objetivo y cómo se decide su estado.
// La pantalla (objetivos.jsx) y el asistente de carga (objetivos-form.jsx) solo
// consumen estas funciones.
//
// Avance automático vs manual
// ---------------------------
// Un objetivo es AUTOMÁTICO cuando el portal ya tiene de dónde sacar el número:
//   · Facturación  → suma de `fact_mensual` del período (solo mensual y anual:
//                    la facturación se carga por mes, no se puede partir en días)
//   · Renovaciones → renovaciones con estado "Renovada" que vencen en el período
// El resto (ventas, marketing, crecimiento, clientes nuevos, personalizados) es
// MANUAL: el avance se carga a mano. Ventas y Clientes nuevos van a poder
// volverse automáticos el día que el portal tenga pólizas y clientes propios;
// por eso el área ya está prevista y solo hay que completar `fuenteDe()`.
// ─────────────────────────────────────────────────────────────────────────────

const OBJ_AREAS = [
  { k: "facturacion",  label: "Facturación",     icono: "card",    color: "#C0241D", bg: "#FBE3E3", auto: true,  unidad: "$" },
  { k: "ventas",       label: "Ventas",          icono: "store",   color: "#EA580C", bg: "#FEF0E6", auto: false, unidad: "pólizas" },
  { k: "marketing",    label: "Marketing",       icono: "mega",    color: "#7C3AED", bg: "#F1EAFE", auto: false, unidad: "acciones" },
  { k: "crecimiento",  label: "Crecimiento",     icono: "trend",   color: "#16A34A", bg: "#E6F4EA", auto: false, unidad: "$" },
  { k: "renovaciones", label: "Renovaciones",    icono: "refresh", color: "#0891B2", bg: "#E0F2FE", auto: true,  unidad: "renovaciones" },
  { k: "clientes",     label: "Nuevos clientes", icono: "user",    color: "#2563EB", bg: "#E8F0FE", auto: false, unidad: "clientes" },
  { k: "otro",         label: "Personalizado",   icono: "flag",    color: "#64748B", bg: "#EEF1F4", auto: false, unidad: "" },
];
const objArea = (k) => OBJ_AREAS.find((a) => a.k === k) || OBJ_AREAS[OBJ_AREAS.length - 1];

const OBJ_PERIODOS = [
  { k: "diario",  label: "Diario" },
  { k: "semanal", label: "Semanal" },
  { k: "mensual", label: "Mensual" },
  { k: "anual",   label: "Anual" },
];
const OBJ_EQUIPOS = ["Comercial", "Siniestros", "Administración", "Toda la oficina"];

const OBJ_MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const OBJ_MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const OBJ_ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

// ---------- fechas ----------
const objIso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const objDia = (iso) => (iso ? new Date(iso + "T00:00:00") : null);
const objHoyIso = () => objIso(new Date());
const objUltimoDia = (anio, mes) => new Date(anio, mes, 0).getDate();

// Lunes de la semana ISO `n` de un año (la semana 1 es la que contiene el 4 de enero)
function objLunesDeSemana(anio, semana) {
  const cuatro = new Date(anio, 0, 4);
  const dow = (cuatro.getDay() + 6) % 7;                 // 0 = lunes
  const lunes1 = new Date(anio, 0, 4 - dow);
  const d = new Date(lunes1);
  d.setDate(d.getDate() + (semana - 1) * 7);
  return d;
}
// Número de semana ISO de una fecha
function objSemanaDe(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + 3);                      // jueves de esa semana
  const primerJueves = new Date(d.getFullYear(), 0, 4);
  const dow2 = (primerJueves.getDay() + 6) % 7;
  primerJueves.setDate(primerJueves.getDate() - dow2 + 3);
  return 1 + Math.round((d - primerJueves) / (7 * 86400000));
}
const objSemanasDelAnio = (anio) => objSemanaDe(new Date(anio, 11, 28));

// Rango [desde, hasta] en ISO a partir de la periodicidad y la referencia elegida
function objRango(periodicidad, ref) {
  const anio = Number(ref.anio) || new Date().getFullYear();
  if (periodicidad === "diario") {
    const f = ref.fecha || objHoyIso();
    return { desde: f, hasta: f };
  }
  if (periodicidad === "semanal") {
    const lunes = objLunesDeSemana(anio, Number(ref.semana) || 1);
    const domingo = new Date(lunes);
    domingo.setDate(domingo.getDate() + 6);
    return { desde: objIso(lunes), hasta: objIso(domingo) };
  }
  if (periodicidad === "anual") {
    return { desde: anio + "-01-01", hasta: anio + "-12-31" };
  }
  const mes = Number(ref.mes) || 1;
  return {
    desde: anio + "-" + String(mes).padStart(2, "0") + "-01",
    hasta: anio + "-" + String(mes).padStart(2, "0") + "-" + String(objUltimoDia(anio, mes)).padStart(2, "0"),
  };
}

// El período inmediatamente anterior, del mismo largo (para la tendencia)
function objRangoAnterior(o) {
  const d = objDia(o.fechaDesde), h = objDia(o.fechaHasta);
  if (!d || !h) return null;
  if (o.periodicidad === "mensual") {
    const a = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return objRango("mensual", { anio: a.getFullYear(), mes: a.getMonth() + 1 });
  }
  if (o.periodicidad === "anual") return objRango("anual", { anio: d.getFullYear() - 1 });
  const largo = Math.round((h - d) / 86400000) + 1;
  const nh = new Date(d); nh.setDate(nh.getDate() - 1);
  const nd = new Date(nh); nd.setDate(nd.getDate() - largo + 1);
  return { desde: objIso(nd), hasta: objIso(nh) };
}

function objPeriodoTexto(o) {
  const d = objDia(o.fechaDesde);
  if (!d) return "—";
  if (o.periodicidad === "diario") return fmtDate(o.fechaDesde);
  if (o.periodicidad === "semanal") return `Semana ${objSemanaDe(d)} · ${fmtDateShort(o.fechaDesde)} al ${fmtDateShort(o.fechaHasta)}`;
  if (o.periodicidad === "anual") return `Año ${d.getFullYear()}`;
  return `${OBJ_MESES[d.getMonth() + 1]} ${d.getFullYear()}`;
}

// ---------- avance ----------
// ¿El avance de este objetivo lo calcula el sistema?
function objEsAuto(o) {
  const a = objArea(o.area);
  if (!a.auto) return false;
  // la facturación se carga por mes: no se puede repartir en días ni semanas
  if (o.area === "facturacion") return o.periodicidad === "mensual" || o.periodicidad === "anual";
  return true;
}
// Cuánto lleva acumulado el objetivo en un rango dado, según su área
function objMedir(o, rango, fuentes) {
  if (!rango) return 0;
  const f = fuentes || {};
  if (o.area === "facturacion") {
    const d = objDia(rango.desde), h = objDia(rango.hasta);
    return (f.movs || [])
      .filter((m) => {
        const primero = new Date(Number(m.anio), Number(m.mes) - 1, 1);
        return primero >= new Date(d.getFullYear(), d.getMonth(), 1) && primero <= h;
      })
      .reduce((s, m) => s + (Number(m.total) || 0), 0);
  }
  if (o.area === "renovaciones") {
    return (f.renovaciones || [])
      .filter((r) => !r.eliminado && r.estado === "Renovada" && r.finVig >= rango.desde && r.finVig <= rango.hasta)
      .length;
  }
  return 0;
}
function objAvance(o, fuentes) {
  if (!objEsAuto(o)) return Number(o.valorActual) || 0;
  return objMedir(o, { desde: o.fechaDesde, hasta: o.fechaHasta }, fuentes);
}
function objPct(o, fuentes) {
  const meta = Number(o.meta) || 0;
  if (!meta) return 0;
  return Math.round((objAvance(o, fuentes) / meta) * 1000) / 10;
}
// Variación contra el período anterior, en %. null si no se puede comparar.
function objTendencia(o, fuentes) {
  if (!objEsAuto(o)) return null;
  const antes = objMedir(o, objRangoAnterior(o), fuentes);
  if (!antes) return null;
  return Math.round(((objAvance(o, fuentes) - antes) / antes) * 1000) / 10;
}

// ---------- estado ----------
// Qué proporción del período ya transcurrió (0-100). null si no está en curso.
function objRitmo(o) {
  const d = objDia(o.fechaDesde), h = objDia(o.fechaHasta);
  if (!d || !h) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (hoy < d || hoy > h) return null;
  const total = (h - d) + 86400000;
  return ((hoy - d) + 86400000) / total * 100;
}
const objVencido = (o) => { const h = objDia(o.fechaHasta); const hoy = new Date(); hoy.setHours(0,0,0,0); return !!h && h < hoy; };
const objDiasRestantes = (o) => { const h = objDia(o.fechaHasta); if (!h) return null; const hoy = new Date(); hoy.setHours(0,0,0,0); return Math.round((h - hoy) / 86400000); };

const OBJ_ESTADOS = {
  cumplido: { k: "cumplido", label: "Cumplido",  color: "#16A34A", bg: "#E6F4EA", fg: "#15803D", icono: "check" },
  curso:    { k: "curso",    label: "En curso",  color: "#2563EB", bg: "#E8F0FE", fg: "#1D4ED8", icono: "clock" },
  atrasado: { k: "atrasado", label: "Atrasado",  color: "#EA580C", bg: "#FEF3E2", fg: "#B45309", icono: "alert" },
};
function objEstado(o, fuentes) {
  const pct = objPct(o, fuentes);
  if (pct >= 100) return OBJ_ESTADOS.cumplido;
  if (objVencido(o)) return OBJ_ESTADOS.atrasado;
  const ritmo = objRitmo(o);
  if (ritmo != null && pct < ritmo - 10) return OBJ_ESTADOS.atrasado;
  return OBJ_ESTADOS.curso;
}

// ---------- formato ----------
const objEsPlata = (o) => !o.unidad || o.unidad === "$";
function objFmt(o, v) {
  const n = Number(v) || 0;
  if (objEsPlata(o)) return OBJ_ARS.format(n);
  return (Math.round(n * 100) / 100).toLocaleString("es-AR") + (o.unidad ? " " + o.unidad : "");
}
const objPctTxt = (v) => (Math.round(v * 10) / 10).toLocaleString("es-AR") + "%";
// "1.234.567,89" o "1234567.89" → número
function objNum(v) {
  if (v === "" || v == null) return 0;
  const s = String(v).replace(/[$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

Object.assign(window, {
  OBJ_AREAS, objArea, OBJ_PERIODOS, OBJ_EQUIPOS, OBJ_MESES, OBJ_MESES_CORTO, OBJ_ARS, OBJ_ESTADOS,
  objIso, objDia, objHoyIso, objUltimoDia, objLunesDeSemana, objSemanaDe, objSemanasDelAnio,
  objRango, objRangoAnterior, objPeriodoTexto,
  objEsAuto, objMedir, objAvance, objPct, objTendencia,
  objRitmo, objVencido, objDiasRestantes, objEstado,
  objEsPlata, objFmt, objPctTxt, objNum,
});
