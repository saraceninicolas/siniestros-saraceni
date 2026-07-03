// denuncia.js — Lectura de la denuncia (PDF) y autocompletado aproximado.
// Usa pdf.js (CDN) para extraer el texto y heurísticas para detectar campos.
// Best-effort: funciona con PDFs que tengan texto seleccionable (no escaneos).

(function () {
  if (window.pdfjsLib) {
    try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch (e) { /* noop */ }
  }

  async function extractText(file) {
    if (!window.pdfjsLib) throw new Error("pdf.js no está cargado");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    return text;
  }

  function toIso(s) {
    const m = String(s).match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) return "";
    let d = m[1], mo = m[2], y = m[3];
    if (y.length === 2) y = "20" + y;
    return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }

  function parseDenuncia(text) {
    const t = (text || "").replace(/ /g, " ").replace(/[ \t]+/g, " ");
    const flat = t.replace(/\s+/g, " ");
    const out = {};
    const grab = (re) => { const m = flat.match(re); return m ? m[1] : null; };

    // N° de póliza
    const pol = grab(/p[oó]liza[^0-9]{0,18}([0-9][0-9.\-\/ ]{4,})/i);
    if (pol) out.poliza = pol.replace(/[.\-\/\s]/g, "");

    // N° de siniestro
    const sin = grab(/siniestro[^0-9A-Za-z]{0,18}([0-9][0-9.\-\/ ]{4,}|[A-Z0-9]{6,})/i);
    if (sin) out.nroSiniestro = sin.replace(/[.\-\/\s]/g, "");

    // Patente / dominio (formatos AR: ABC123 o AB123CD)
    const pat = grab(/(?:dominio|patente)[^A-Z0-9]{0,10}([A-Z]{2,3}\s?\d{3}\s?[A-Z]{0,2})/i);
    if (pat) out._patente = pat.replace(/\s/g, "").toUpperCase();

    // Fechas etiquetadas
    const occ = grab(/fecha\s+(?:de|del)?\s*(?:ocurrencia|siniestro|hecho|accidente|evento|acontecimiento)[^0-9]{0,14}(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
    if (occ) out.fechaOcurrido = toIso(occ);
    const den = grab(/fecha\s+(?:de|del)?\s*denuncia[^0-9]{0,14}(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
    if (den) out.fechaDenuncia = toIso(den);

    // Asegurado / cliente
    const ase = grab(/asegurad[oa][:\s]{1,4}([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'\. ]{3,45}?)(?:\s{2,}|,|\bCUIT\b|\bDNI\b|\bP[OÓ]LIZA\b|$)/);
    if (ase) out.cliente = ase.trim().replace(/\s+/g, " ").toUpperCase();

    // Compañía (según nombres conocidos en el texto)
    const upper = flat.toUpperCase();
    const ciaMap = [
      ["MERCANTIL ANDINA", "LMA"], ["MERCANTIL", "LMA"],
      ["PROVINCIA", "PROVINCIA"], ["ALLIANZ", "ALLIANZ"], ["SANCOR", "SANCOR"],
      ["FEDERACION PATRONAL", "FEDERACION"], ["FEDERACIÓN", "FEDERACION"], ["FEDERACION", "FEDERACION"],
      ["SAN CRISTOBAL", "SAN CRISTOBAL"], ["SAN CRISTÓBAL", "SAN CRISTOBAL"], ["ZURICH", "ZURICH"],
    ];
    for (const [needle, code] of ciaMap) { if (upper.indexOf(needle) >= 0) { out.cia = code; break; } }

    // Ramo aproximado
    if (/\b(auto|autom[oó]tor|veh[ií]culo|dominio|patente)\b/i.test(flat)) out.ramo = "AUTO";
    else if (/\bhogar\b/i.test(flat)) out.ramo = "HOGAR";

    return out;
  }

  window.parseDenunciaPDF = async function (file) {
    const text = await extractText(file);
    return parseDenuncia(text);
  };
})();
