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

// Coberturas: solo el ramo AUTO usa este desplegable fijo.
// Para el resto de los ramos la cobertura es texto libre.
const COBERTURAS_AUTO = ["TERCEROS COMPLETOS", "TODO RIESGO", "B"];
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
    // estado, cliente, cia, ramo, hecho, cobertura, poliza, nroSin, ocurrido, denuncia, limite, inspeccion, gestionAR, gestionReal, gestor, email, obs, ticket, calendar, modAgo
    ["Abierto","SARACENI VERONICA","LMA","AUTO","DAÑO PARCIAL","M PLUS","516208977","501032421224","2026-06-01","2026-06-02","2026-06-08","","Rilla: reclamar línea de colectivo","Denuncia en LMA y Rilla para demandar","Coca, Julieta","julieta.coca@lamercantil.com.ar","Choque colectivo, espejo y lateral derecho","",true,0],
    ["Abierto","ONLY GAVIOTAS","LMA","AUTO","DAÑO PARCIAL","TR 2%","516755196","501032421169","2026-05-13","2026-05-15","2026-06-05","2026-05-15","Responder ticket después de respuesta","Propuesta de LMA enviada a Alonso (indemnización)","Coca, Julieta","julieta.coca@lamercantil.com.ar","Siniestro capó, carta franquicia pedida 1/6","https://mercantilandina.cloud.invgate.net/requests/show/index/id/313297",true,1],
    ["Abierto","PALOMEQUE FERNANDO","LMA","HOGAR","ROBO TOTAL","TR PORTATIL","163221780","1601032420027","2026-05-13","2026-05-18","2026-06-08","2026-06-01","Consultar a Fernando semana del 8","Gestor en contacto con el asegurado","Brian Rozza","brian.rozza@lamercantil.com.ar","Notebook — robo total","https://mercantilandina.cloud.invgate.net/requests/show/index/id/313329",true,1],
    ["Abierto","TOTAL OBRAS SRL","LMA","AUTO","ROBO TOTAL","TR 4%","516109137","501032421162","2026-05-13","2026-05-14","2026-06-08","2026-06-01","Pedir status","Enviado a Micaela dato de gestor para iniciar baja","Gisela Perdiguero","gisela.perdiguero@lamercantil.com.ar","Gestor asignado y comunicado","https://mercantilandina.cloud.invgate.net/requests/show/index/id/312149",true,2],
    ["Abierto","TOTAL OBRAS SRL","LMA","AUTO","DAÑO PARCIAL","TR 2%","516109137","501032421147","2026-03-18","2026-05-11","2026-06-04","2026-06-01","Consultar si realizaron inspección por taller","Inspección 4/6","Cristina Maciel","cristina.maciel@lamercantil.com.ar","Espejo — LMA vs LMA","",true,2],
    ["Abierto","CORDUA MARIA HAYDEE","PROVINCIA","AUTO","ROBO TOTAL","TC","11003464","2452484","2026-04-29","2026-04-30","2026-06-08","","Preguntar cómo viene con gestor próxima semana","Gestor enviado a cliente para baja","Santoro, Agustina","santoroa@pseguros.com.ar","Gestor comunicado con cliente","",true,3],
    ["Abierto","MESSANO JULIAN","LMA","AUTO","DAÑO PARCIAL","TR 2%","516873306","501032421213","2026-05-27","2026-05-29","2026-06-05","","Aguardar a la asegurada","","Chacón, Grace","grace.chacon@lamercantil.com.ar","Choque aeropuerto Vrtus — espera WhatsApp 29/05","",false,0],
    ["Abierto","PREZZEMOLI","LMA","AUTO","ROBO TOTAL","TR 2%","515789745","501032420805","2026-02-04","2026-02-05","2026-06-09","","Consultar status a Richard","Mensaje a gestora para ayudar a Richard","Gisela Perdiguero","gisela.perdiguero@lamercantil.com.ar","La demora es por los CGPS","",true,4],
    ["Abierto","DIEGO ALONSO","ALLIANZ","ICO","CRISTAL","CRISTAL","260220740624","2260233167","2026-03-26","2026-05-28","2026-06-04","2026-05-29","Enviar CBU y factura a Allianz para pago","Mail 2/6 pedido factura y CBU a Elisa","Zalazar, Eliana Desirée","eliana.zalazar@allianz.com.ar","Vidrio roto — ubicación / siniestro demorado","",true,1],
    ["Terminado","ONLY GAVIOTAS","LMA","AUTO","DAÑO PARCIAL","TR 2%","516755196","501032421182","2026-05-20","2026-05-20","","2026-05-28","","Carta de franquicia enviada — cerrado","Chacón, Grace","grace.chacon@lamercantil.com.ar","Lateral. Carta franquicia enviada","",false,6],
    ["Terminado","SIGNALS SOLUTIONS","ALLIANZ","COMERCIO","DAÑO PARCIAL","TC","250040510835","2260231183","2026-05-08","2026-05-10","","2026-05-18","","Siniestro cerrado y conformado","Mesa de Allianz","siniestros@allianz.com.ar","Cerrado","",false,10],
    ["Terminado","VILLAGOIZ HERNAN","LMA","AUTO","DAÑO PARCIAL","M PLUS","516200730","501032421171","2026-05-15","2026-05-15","","2026-05-22","","Reseña pedida y recibida — cerrado","Coca, Julieta","julieta.coca@lamercantil.com.ar","Reseña pedida y recibida","",false,8],
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
      gestionAR, gestionReal, gestiones, gestor, gestorEmail, obs, ticket,
      franquiciaPct: "", franquiciaMonto: "",
      enCalendario: !!calendar,
      ultimaModPor: STATIONS[n % 2], ultimaModFecha: recentIso(modAgo, 9 + (n % 7), (n * 11) % 60),
      eliminado: false,
    };
  });
}

Object.assign(window, {
  CIA_FULL, CIAS, ciaLabel, RAMOS, RAMO_LABEL, RAMO_ICON, HECHOS, HECHO_LABEL,
  COBERTURAS, COBERTURAS_AUTO, esRamoAuto, coberturasDe, aplicaFranquicia,
  STATIONS, ESTADOS, ESTADO_LIST, URGENCIA,
  fmtDate, fmtDateShort, fmtTimeAgo, daysUntil, urgenciaDe, venceTexto, nowIso,
  nextNum, sinId, buildSeed,
});
