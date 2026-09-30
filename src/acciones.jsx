// acciones.jsx — Qué se hizo, cuándo y quién
// ─────────────────────────────────────────────────────────────────────────────
// Un registro de movimientos que sirve igual para una cotización y para un
// objetivo: "llamé al cliente", "mandé la cotización", "se cerró", "cargué el
// avance de septiembre". Una fila por cosa que pasó, firmada.
//
// Vive en su propio archivo y no adentro de Comercial porque Objetivos usa lo
// mismo, y no tiene por qué depender de una pantalla que no le importa.
//
// Los tipos son dos listas distintas a propósito: en una gestión comercial
// "emisión" quiere decir algo y en un objetivo no significa nada. Ofrecer
// veinte opciones donde sirven cinco es la forma más rápida de que nadie
// complete el campo.
// ─────────────────────────────────────────────────────────────────────────────

const ACC_TIPOS = [
  { clave: "llamado",     label: "Llamado",            icon: "phone" },
  { clave: "whatsapp",    label: "WhatsApp",           icon: "mail" },
  { clave: "mail",        label: "Mail",               icon: "mail" },
  { clave: "reunion",     label: "Reunión",            icon: "user" },
  { clave: "cotizacion",  label: "Cotización enviada", icon: "doc" },
  { clave: "seguimiento", label: "Seguimiento",        icon: "refresh" },
  { clave: "cierre",      label: "Cierre",             icon: "check" },
  { clave: "emision",     label: "Emisión",            icon: "shield" },
  { clave: "perdida",     label: "Se perdió",          icon: "close" },
  { clave: "nota",        label: "Nota",               icon: "edit" },
];

const ACC_TIPOS_OBJ = [
  { clave: "avance",    label: "Cargó avance",  icon: "trend" },
  { clave: "llamado",   label: "Llamado",       icon: "phone" },
  { clave: "reunion",   label: "Reunión",       icon: "user" },
  { clave: "revision",  label: "Revisión",      icon: "check" },
  { clave: "nota",      label: "Nota",          icon: "edit" },
];

function accTipo(t, lista) {
  const l = lista || ACC_TIPOS.concat(ACC_TIPOS_OBJ);
  return l.find((x) => x.clave === t) || { clave: t, label: t, icon: "edit" };
}

// Hace cuántos días que nadie la toca. Es el dato que más sirve de un registro
// así: algo sin novedades hace tres semanas está frenado aunque el estado diga
// que va bien.
function accDiasQuieto(acciones, desdeSiNoHay) {
  const ultima = acciones && acciones[0];
  const desde = ultima ? ultima.fecha : desdeSiNoHay;
  if (!desde) return null;
  return Math.floor((Date.now() - new Date(desde).getTime()) / 86400000);
}

// ---------- la línea de tiempo, con el alta arriba ----------
function HistorialAcciones({ acciones, tipos, tipoInicial, onAccion, onBorrar, placeholder }) {
  const lista = tipos || ACC_TIPOS;
  const [tipo, setTipo] = React.useState(tipoInicial || lista[0].clave);
  const [nota, setNota] = React.useState("");
  const agregar = () => {
    onAccion({ tipo, nota: nota.trim() });
    setNota("");
  };
  return (
    <div className="acc-hist">
      <div className="acc-alta">
        <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {lista.map((t) => <option key={t.clave} value={t.clave}>{t.label}</option>)}
        </select>
        <input className="input" value={nota} placeholder={placeholder || "Qué pasó…"}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") agregar(); }} />
        <button className="btn-primary" onClick={agregar}><Ico name="plus" size={15} />Anotar</button>
      </div>
      {(!acciones || acciones.length === 0)
        ? <div className="acc-vacio">Todavía no se anotó ningún movimiento.</div>
        : <div className="acc-linea">
            {acciones.map((a) => {
              const t = accTipo(a.tipo, lista);
              return (
                <div className="acc-mov" key={a.id}>
                  <span className="acc-mov-ico"><Ico name={t.icon} size={14} /></span>
                  <div className="acc-mov-txt">
                    <div className="acc-mov-tit">
                      <b>{t.label}</b>
                      {a.nota && <span className="acc-mov-nota"> · {a.nota}</span>}
                    </div>
                    <div className="acc-mov-pie">
                      {a.usuario} · {fmtDate(String(a.fecha).slice(0, 10))} · {fmtTimeAgo(a.fecha)}
                    </div>
                  </div>
                  {onBorrar && <button className="acc-mov-x" title="Borrar este movimiento"
                    onClick={() => onBorrar(a)}><Ico name="close" size={13} /></button>}
                </div>
              );
            })}
          </div>}
    </div>
  );
}

Object.assign(window, { ACC_TIPOS, ACC_TIPOS_OBJ, accTipo, accDiasQuieto, HistorialAcciones });

// Marca este archivo como modulo ES (ver el comentario de data.jsx).
export {};
