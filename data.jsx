// data.jsx — Saraceni Seguros · seguimiento de siniestros (modelo real del Excel)

// ---- compañías ----
const CIA_FULL = {
  "LMA": "La Mercantil Andina",
  "PROVINCIA": "Provincia Seguros",
  "ALLIANZ": "Allianz",
  "SANCOR": "Sancor Seguros",
  "FEDERACION": "Federación Patronal",
  "SAN CRISTOBAL": "San Cristóbal",
  "ZURICH": "Zurich",
};
const CIAS = Object.keys(CIA_FULL);
const ciaLabel = (k) => CIA_FULL[k] || k;

// COMERCIO se quita del selector; INT_CONSORCIO se agrega.
// (Se mantiene COMERCIO en los labels para que registros viejos se muestren bien.)
const RAMOS = ["AUTO", "HOGAR", "ICO", "INT_CONSORCIO", "VIDA"];
const RAMO_LABEL = { AUTO: "Auto", HOGAR: "Hogar", ICO: "Int. Comercio", INT_CONSORCIO: "Int. Consorcio", COMERCIO: "Comercio", VIDA: "Vida" };
const RAMO_ICON = { AUTO: "car", HOGAR: "home", ICO: "store", INT_CONSORCIO: "store", COMERCIO: "store", VIDA: "shield" };

const HECHOS = ["DAÑO PARCIAL", "ROBO TOTAL", "CRISTAL", "INCENDIO", "GRANIZO", "RC"];
const HECHO_LABEL = { "DAÑO PARCIAL": "Daño parcial", "ROBO TOTAL": "Robo total", "CRISTAL": "Cristal", "INCENDIO": "Incendio", "GRANIZO": "Granizo", "RC": "Resp. civil" };
// Color del motivo (para que se note de un vistazo, ej. Robo total en rojo)
const HECHO_COLOR = {
  "ROBO TOTAL":   { fg: "#C0241D", bg: "#FBE3E3" },
  "DAÑO PARCIAL": { fg: "#B45309", bg: "#FEF3E2" },
  "CRISTAL":      { fg: "#1D4ED8", bg: "#E8F0FE" },
  "INCENDIO":     { fg: "#C2410C", bg: "#FEECDC" },
  "GRANIZO":      { fg: "#0E7490", bg: "#E0F2FE" },
  "RC":           { fg: "#475569", bg: "#EEF1F4" },
};
const hechoColor = (h) => HECHO_COLOR[h] || { fg: "#475569", bg: "#EEF1F4" };

// Coberturas: solo el ramo AUTO usa este desplegable fijo.
// Para el resto de los ramos la cobertura es texto libre.
const COBERTURAS_AUTO = ["TERCEROS COMPLETOS", "TODO RIESGO", "RESPONSABILIDAD CIVIL"];
// Sugerencias (datalist) para ramos no-auto:
const COBERTURAS = ["M PLUS", "TR 2%", "TR 4%", "TR PORTATIL", "TC", "CRISTAL"];

// ¿El ramo usa el desplegable fijo de coberturas de auto?
function esRamoAuto(ramo) { return ramo === "AUTO"; }
// Coberturas disponibles según ramo (array si es auto, null si es texto libre).
function coberturasDe(ramo) { return esRamoAuto(ramo) ? COBERTURAS_AUTO : null; }
// La franquicia solo aplica a la cobertura TODO RIESGO (auto).
function aplicaFranquicia(cobertura) { return cobertura === "TODO RIESGO"; }

const STATIONS = ["PC_OFICINA_1", "PC_OFICINA_2"];

// Estado: solo dos, como en la planilla real
const ESTADOS = {
  "Abierto":   { key: "Abierto",   fg: "#1D4ED8", bg: "#E8F0FE", dot: "#2563EB" },
  "Terminado": { key: "Terminado", fg: "#15803D", bg: "#E6F4EA", dot: "#16A34A" },
};
const ESTADO_LIST = Object.keys(ESTADOS);

// Urgencia derivada de la fecha límite de respuesta (para los Abiertos)
const URGENCIA = {
  vencido:  { label: "Vencida",     fg: "#B91C1C", bg: "#FBE3E3", dot: "#DC2626" },
  hoy:      { label: "Vence hoy",   fg: "#B45309", bg: "#FEF3E2", dot: "#D97706" },
  proximo:  { label: "Próxima",     fg: "#1D4ED8", bg: "#E8F0FE", dot: "#2563EB" },
  normal:   { label: "En plazo",    fg: "#475569", bg: "#EEF1F4", dot: "#64748B" },
  ninguna:  { label: "—",           fg: "#94A3B8", bg: "#F1F3F5", dot: "#CBD5E1" },
};

// ---- helpers de fecha ----
const pad = (n) => String(n).padStart(2, "0");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function today0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function parseDate(iso) { if (!iso) return null; const d = new Date(iso + "T00:00:00"); return isNaN(d) ? null : d; }
function fmtDate(iso) { const d = parseDate(iso); if (!d) return "—"; return `${pad(d.getDate())} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }
function fmtDateShort(iso) { const d = parseDate(iso); if (!d) return "—"; return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; }
function daysUntil(iso) { const d = parseDate(iso); if (!d) return null; return Math.round((d - today0()) / 86400000); }

function urgenciaDe(item) {
  if (item.estado === "Terminado" || !item.fechaLimite) return "ninguna";
  const du = daysUntil(item.fechaLimite);
  if (du == null) return "ninguna";
  if (du < 0) return "vencido";
  if (du === 0) return "hoy";
  if (du <= 3) return "proximo";
  return "normal";
}
function venceTexto(iso) {
  const du = daysUntil(iso);
  if (du == null) return "—";
  if (du < 0) return `hace ${Math.abs(du)} d`;
  if (du === 0) return "hoy";
  if (du === 1) return "mañana";
  return `en ${du} d`;
}

function fmtTimeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

// Días hábiles transcurridos entre dos fechas (no cuenta sábados ni domingos)
function diasHabilesEntre(desde, hasta) {
  const d0 = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const d1 = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  const corridos = Math.floor((d1 - d0) / 86400000);
  if (corridos <= 0) return 0;
  // Cada semana completa aporta 5 hábiles; el resto se cuenta día por día.
  const semanas = Math.floor(corridos / 7);
  let habiles = semanas * 5;
  const cursor = new Date(d0);
  cursor.setDate(cursor.getDate() + semanas * 7);
  for (let i = 0; i < corridos % 7; i++) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) habiles++;
  }
  return habiles;
}

// Días hábiles que lleva activo el siniestro: desde la denuncia (o el hecho / la carga)
function diasActivo(item) {
  let base = item.fechaDenuncia || item.fechaOcurrido || item.creado || item.ultimaModFecha;
  if (!base) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(base)) base = base + "T00:00:00";
  const d = new Date(base);
  if (isNaN(d)) return null;
  return diasHabilesEntre(d, new Date());
}

let _seq = 0;
const nextNum = () => { _seq += 1; return _seq; };
const sinId = (n) => "STR-" + pad(n) + "-" + Date.now().toString(36).slice(-4);

function nowIso() { return new Date().toISOString(); }
function recentIso(daysAgo, hh = 10, mm = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hh, mm, 0, 0); return d.toISOString();
}

// ---- registros reales (Excel SEGUIMIENTO) ----
function buildSeed() {
  _seq = 0;
  const raw = [
  // DEMO: acá iban los siniestros reales del broker. Se vaciaron a propósito:
  // esta rama es pública y no puede contener datos de clientes. Los siniestros
  // de la demostración son inventados y salen de demo-db.js.
  ];
  return raw.map((r) => {
    const [estado, cliente, cia, ramo, hecho, cobertura, poliza, nroSiniestro, ocurrido, denuncia, limite, inspeccion, gestionAR, gestionReal, gestor, gestorEmail, obs, ticket, calendar, modAgo] = r;
    const n = nextNum();
    const gestiones = gestionReal && gestionReal.trim()
      ? [{ fecha: (denuncia || ocurrido || ""), texto: gestionReal, pc: STATIONS[n % 2] }]
      : [];
    return {
      id: sinId(n), n, estado, cliente, cia, ramo, hecho, cobertura,
      poliza, nroSiniestro,
      fechaOcurrido: ocurrido, fechaDenuncia: denuncia, fechaLimite: limite,
      fechaInspeccion: inspeccion,
      dominio: "", referencia: "",
      gestionAR, gestionReal, gestiones, gestor, gestorEmail, gestorTel: "", obs, ticket,
      franquiciaPct: "", franquiciaMonto: "", adjuntos: [],
      enCalendario: !!calendar,
      ultimaModPor: STATIONS[n % 2], ultimaModFecha: recentIso(modAgo, 9 + (n % 7), (n * 11) % 60),
      creado: denuncia ? denuncia + "T09:00:00" : recentIso(modAgo, 9, 0),
      eliminado: false,
    };
  });
}

Object.assign(window, {
  CIA_FULL, CIAS, ciaLabel, RAMOS, RAMO_LABEL, RAMO_ICON, HECHOS, HECHO_LABEL, HECHO_COLOR, hechoColor,
  COBERTURAS, COBERTURAS_AUTO, esRamoAuto, coberturasDe, aplicaFranquicia,
  STATIONS, ESTADOS, ESTADO_LIST, URGENCIA,
  fmtDate, fmtDateShort, fmtTimeAgo, daysUntil, urgenciaDe, venceTexto, diasActivo, nowIso,
  parseDate, today0, diasHabilesEntre, MESES,
  nextNum, sinId, buildSeed,
});
