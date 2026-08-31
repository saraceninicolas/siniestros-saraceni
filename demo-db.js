// demo-db.js — Base de datos FALSA, en memoria, para la demostración
// ─────────────────────────────────────────────────────────────────────────────
// Esta rama (`demo`) NO lleva `config.js` ni `db.js`: en su lugar carga este
// archivo, que expone la misma interfaz `window.DB` pero contra arrays en
// memoria. Consecuencias buscadas:
//
//   • No hay ninguna credencial de Supabase en esta rama. La demo no puede
//     tocar la base del portal real porque no sabe dónde está ni tiene clave.
//   • Todo lo que se carga o edita vive en la pestaña: al recargar, vuelve al
//     estado inicial. Se puede probar el sistema sin romper nada.
//   • Todos los datos son INVENTADOS. Ningún cliente, póliza ni siniestro real.
//
// Si algún día esta demo pasa a ser un sistema de verdad, se reemplaza este
// archivo por `config.js` + `db.js` y no hay que tocar nada más.
// ─────────────────────────────────────────────────────────────────────────────

window.DEMO = true;

(function () {
  // ---- helpers de fecha (todo relativo a hoy, para que la demo no envejezca) ----
  const hoy = new Date();
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const dias = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return iso(d); };
  const diasIso = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); d.setHours(10, 30, 0, 0); return d.toISOString(); };
  const meses = (n) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() + n, 1); return { anio: d.getFullYear(), mes: d.getMonth() + 1 }; };
  const clonar = (x) => JSON.parse(JSON.stringify(x));
  const espera = (v) => new Promise((r) => setTimeout(() => r(v), 120));   // simula la latencia de red

  // ============================ SINIESTROS ============================
  // [estado, cliente, dominio, cia, ramo, hecho, cobertura, poliza, nroSin,
  //  diasDesdeDenuncia, diasHastaLimite, gestionAR, gestionReal, gestor, obs]
  const SIN = [
    ["Abierto", "MARTINEZ GRACIELA", "AB 123 CD", "LMA", "AUTO", "DAÑO PARCIAL", "TR 2%", "516200145", "501032422101", 4, 2,
      "Reclamar presupuesto del taller", "Denuncia presentada, espera turno de inspección", "Coca, Julieta", "Choque en Av. Mitre, lateral derecho"],
    ["Abierto", "LOGISTICA DEL SUR SRL", "AC 887 KL", "ALLIANZ", "AUTO", "ROBO TOTAL", "TR 4%", "260220741188", "2260234410", 22, -3,
      "Pedir status del gestor de baja", "Gestor asignado, falta la baja en el registro", "Zalazar, Eliana", "Robo en playa de estacionamiento"],
    ["Abierto", "PEREYRA HECTOR", "AD 445 TR", "PROVINCIA", "AUTO", "CRISTAL", "TC", "11004521", "2455120", 3, 1,
      "Enviar CBU para el reintegro", "Cristal cambiado, falta el pago", "Santoro, Agustina", "Parabrisas, cambio en taller adherido"],
    ["Abierto", "CONSORCIO EDIFICIO BELGRANO 1240", "", "SANCOR", "INT_CONSORCIO", "RC", "M PLUS", "770112455", "8801245", 11, 6,
      "Mandar la denuncia policial que falta", "Perito visitó el edificio el lunes", "Mesa Sancor", "Caída de mampostería sobre un auto"],
    ["Abierto", "GOMEZ SILVANA", "", "LMA", "HOGAR", "ROBO TOTAL", "TR PORTATIL", "163225512", "1601032422215", 8, 4,
      "Consultar si aceptaron la factura de la notebook", "Documentación enviada a la compañía", "Rozza, Brian", "Robo de notebook fuera del domicilio"],
    ["Abierto", "ALMACEN DON PEPE", "", "ALLIANZ", "ICO", "INCENDIO", "TC", "250040512299", "2260232877", 31, 0,
      "Reunión con el liquidador", "Liquidador designado, pidió balance", "Mesa Allianz", "Principio de incendio en tablero eléctrico"],
    ["Abierto", "QUIROGA FEDERICO", "AE 991 PS", "FEDERACION", "AUTO", "GRANIZO", "TR 2%", "884512003", "9912445", 6, 3,
      "Aguardar turno de inspección", "Fotos enviadas, espera perito", "Mesa Federación", "Granizo del 12, techo y capot"],
    ["Abierto", "TEXTIL MORENO SA", "", "SAN CRISTOBAL", "ICO", "DAÑO PARCIAL", "TC", "445120087", "5510223", 15, 9,
      "Presentar los tres presupuestos", "Presupuesto 1 cargado", "Mesa San Cristóbal", "Daño por agua en depósito"],
    ["Terminado", "LOPEZ RAMIRO", "AA 552 QW", "LMA", "AUTO", "CRISTAL", "CRISTAL", "516112008", "501032421990", 12, null,
      "", "Cristal repuesto y siniestro cerrado", "Coca, Julieta", "Luneta trasera"],
    ["Terminado", "BENITEZ CARLA", "AB 774 ZX", "PROVINCIA", "AUTO", "DAÑO PARCIAL", "TC", "11003998", "2451007", 48, null,
      "", "Indemnización acreditada, conforme firmado", "Santoro, Agustina", "Choque en cadena, tres vehículos"],
    ["Terminado", "ESTUDIO CONTABLE RIVAS", "", "ALLIANZ", "ICO", "CRISTAL", "TC", "250040511044", "2260231955", 21, null,
      "", "Vidriera repuesta, cerrado", "Mesa Allianz", "Rotura de vidriera"],
    ["Terminado", "SUAREZ MONICA", "", "LMA", "HOGAR", "INCENDIO", "M PLUS", "163220098", "1601032421770", 74, null,
      "", "Indemnización pagada, siniestro cerrado", "Rozza, Brian", "Incendio de cocina"],
    ["Terminado", "TRANSPORTES AGUIRRE", "AC 118 MN", "LMA", "AUTO", "ROBO TOTAL", "TR 4%", "516108822", "501032421455", 96, null,
      "", "Baja completa, indemnización cobrada", "Perdiguero, Gisela", "Robo total, recuperado sin partes"],
    ["Terminado", "VILLALBA NORMA", "AD 220 FG", "SANCOR", "AUTO", "DAÑO PARCIAL", "TR 2%", "770118821", "8802001", 33, null,
      "", "Reparado en taller oficial, cerrado", "Mesa Sancor", "Puerta trasera izquierda"],
    ["Terminado", "KIOSCO LA ESQUINA", "", "FEDERACION", "ICO", "ROBO TOTAL", "TC", "884511200", "9911002", 62, null,
      "", "Indemnización acordada y pagada", "Mesa Federación", "Robo con fractura"],
    ["Terminado", "IBARRA JOSE LUIS", "AE 003 HJ", "ALLIANZ", "AUTO", "GRANIZO", "TR 2%", "260220740099", "2260230554", 27, null,
      "", "Reparación terminada, conforme firmado", "Zalazar, Eliana", "Granizo, techo y baúl"],
  ];
  let siniestros = SIN.map((r, i) => {
    const [estado, cliente, dominio, cia, ramo, hecho, cobertura, poliza, nroSiniestro, desdeDen, hastaLim, gestionAR, gestionReal, gestor, obs] = r;
    // Los terminados se cierran a los ~2/3 del tiempo transcurrido desde la denuncia
    const cierre = estado === "Terminado" ? diasIso(-Math.round(desdeDen / 3)) : diasIso(-(i % 5));
    return {
      _dbId: i + 1, id: "STR-" + String(i + 1).padStart(2, "0") + "-DEMO", n: i + 1,
      estado, cliente, dominio, referencia: "", cia, ramo, hecho, cobertura, poliza, nroSiniestro,
      fechaOcurrido: dias(-desdeDen - 1), fechaDenuncia: dias(-desdeDen),
      fechaLimite: hastaLim == null ? "" : dias(hastaLim),
      fechaInspeccion: "", gestionAR, gestionReal,
      gestiones: gestionReal ? [{ fecha: dias(-Math.round(desdeDen / 2)), texto: gestionReal, pc: "Demo" }] : [],
      gestor, gestorEmail: "siniestros@compania.com.ar", gestorTel: "",
      obs, ticket: "", franquiciaPct: "", franquiciaMonto: "",
      adjuntos: [], enCalendario: i % 3 === 0, asignadoA: null,
      ultimaModPor: "Demo", ultimaModFecha: cierre,
      creado: dias(-desdeDen) + "T09:00:00", eliminado: false,
    };
  });

  // ============================ FACTURACIÓN ============================
  let companias = [
    { id: 1, razonSocial: "LA MERCANTIL ANDINA", cuit: "30500002611", tipo: "A", envio: "WEB", banco: "RIO", notas: "", activa: true, orden: 1 },
    { id: 2, razonSocial: "ALLIANZ ARGENTINA", cuit: "30500003552", tipo: "A", envio: "facturacion@allianz.com.ar", banco: "BBVA", notas: "", activa: true, orden: 2 },
    { id: 3, razonSocial: "PROVINCIA SEGUROS", cuit: "30500001234", tipo: "A", envio: "WEB", banco: "RIO", notas: "", activa: true, orden: 3 },
    { id: 4, razonSocial: "SANCOR SEGUROS", cuit: "30504870610", tipo: "A", envio: "WEB", banco: "RIO", notas: "", activa: true, orden: 4 },
    { id: 5, razonSocial: "FEDERACION PATRONAL", cuit: "30500003994", tipo: "A", envio: "cobranzas@fedpat.com.ar", banco: "BBVA", notas: "", activa: true, orden: 5 },
    { id: 6, razonSocial: "SAN CRISTOBAL SEGUROS", cuit: "30500012345", tipo: "A", envio: "WEB", banco: "RIO", notas: "", activa: true, orden: 6 },
    { id: 7, razonSocial: "SEGUROS DEL LITORAL", cuit: "30712345678", tipo: "B", envio: "WEB", banco: "RIO", notas: "Empezó a facturar este año", activa: true, orden: 7 },
    { id: 8, razonSocial: "ART NORTE", cuit: "30699988877", tipo: "A", envio: "WEB", banco: "RIO", notas: "No factura desde el año pasado", activa: false, orden: 8 },
  ];
  // 20 meses de facturación hacia atrás, con crecimiento y algo de ruido
  let mensual = (function () {
    const base = { 1: 2450000, 2: 2080000, 3: 760000, 4: 690000, 5: 540000, 6: 430000, 7: 310000 };
    const filas = [];
    let id = 1;
    for (let atras = 19; atras >= 0; atras--) {
      const { anio, mes } = meses(-atras);
      companias.forEach((c) => {
        if (!base[c.id]) return;
        if (c.id === 7 && atras > 7) return;                       // el litoral arranca hace 7 meses
        const crece = 1 + (19 - atras) * 0.021;
        const ruido = 0.86 + (((c.id * 7 + mes * 13 + anio) % 11) / 28);
        const neto = Math.round(base[c.id] * crece * ruido);
        const total = c.tipo === "A" ? Math.round(neto * 1.21) : neto;
        // el mes en curso queda a medio cobrar, como pasa en la vida real
        let pago = total;
        if (atras === 0) pago = c.id === 4 ? 0 : Math.round(total * (c.id % 3 === 0 ? 0.7 : c.id % 2 === 0 ? 0.55 : 0.35));
        if (atras === 1) pago = Math.round(total * 0.93);
        filas.push({
          _dbId: id++, companiaId: c.id, anio, mes,
          fecha: anio + "-" + String(mes).padStart(2, "0") + "-05",
          nroFactura: "0001-" + String(10000 + id).slice(-5),
          neto, iva: total - neto, total, enviado: true, pago,
          observaciones: "", ultimaModPor: "Demo",
        });
      });
    }
    return filas;
  })();

  // ============================ OBJETIVOS ============================
  const mesAct = meses(0), mesAnt = meses(-1);
  let objetivos = [
    { _dbId: 1, id: "OBJ-0001", n: 1, titulo: "Facturación de este mes", tipo: "facturacion", mes: mesAct.mes, anio: mesAct.anio, meta: 12500000, valorActual: null, unidad: "$", notas: "", eliminado: false, ultimaModPor: "Demo", ultimaModFecha: diasIso(-2) },
    { _dbId: 2, id: "OBJ-0002", n: 2, titulo: "Facturación del año", tipo: "facturacion", mes: null, anio: mesAct.anio, meta: 110000000, valorActual: null, unidad: "$", notas: "meta anual del estudio", eliminado: false, ultimaModPor: "Demo", ultimaModFecha: diasIso(-20) },
    { _dbId: 3, id: "OBJ-0003", n: 3, titulo: "Pólizas nuevas del mes", tipo: "manual", mes: mesAct.mes, anio: mesAct.anio, meta: 15, valorActual: 9, unidad: "pólizas", notas: "", eliminado: false, ultimaModPor: "Demo", ultimaModFecha: diasIso(-1) },
    { _dbId: 4, id: "OBJ-0004", n: 4, titulo: "Clientes nuevos del mes", tipo: "manual", mes: mesAct.mes, anio: mesAct.anio, meta: 8, valorActual: 3, unidad: "clientes", notas: "cuesta más que el mes pasado", eliminado: false, ultimaModPor: "Demo", ultimaModFecha: diasIso(-3) },
    { _dbId: 5, id: "OBJ-0005", n: 5, titulo: "Facturación del mes pasado", tipo: "facturacion", mes: mesAnt.mes, anio: mesAnt.anio, meta: 9000000, valorActual: null, unidad: "$", notas: "", eliminado: false, ultimaModPor: "Demo", ultimaModFecha: diasIso(-32) },
    { _dbId: 6, id: "OBJ-0006", n: 6, titulo: "Renovaciones retenidas", tipo: "manual", mes: mesAct.mes, anio: mesAct.anio, meta: 20, valorActual: 17, unidad: "renovaciones", notas: "", eliminado: false, ultimaModPor: "Demo", ultimaModFecha: diasIso(-4) },
  ];

  // ============================ RENOVACIONES ============================
  const RENOV = [
    ["POL-88120", "MARTINEZ GRACIELA", "LA MERCANTIL ANDINA", "Automotores", -350, 15, "Pendiente", ""],
    ["POL-77455", "LOGISTICA DEL SUR SRL", "ALLIANZ", "Flota", -352, 13, "En gestión", "Pidieron cotizar contra Federación"],
    ["POL-91002", "GOMEZ SILVANA", "PROVINCIA SEGUROS", "Combinado familiar", -358, 7, "En gestión", "Espera respuesta del cliente"],
    ["POL-45120", "ALMACEN DON PEPE", "ALLIANZ", "Integral de comercio", -360, 5, "Pendiente", ""],
    ["POL-33887", "PEREYRA HECTOR", "SANCOR SEGUROS", "Automotores", -362, 3, "Renovada", "Renovada con 12% de aumento"],
    ["POL-56201", "TEXTIL MORENO SA", "SAN CRISTOBAL", "Integral de comercio", -364, 1, "En gestión", "Falta la firma"],
    ["POL-12008", "QUIROGA FEDERICO", "FEDERACION PATRONAL", "Automotores", -366, -1, "Renovada", ""],
    ["POL-70112", "CONSORCIO BELGRANO 1240", "SANCOR SEGUROS", "Consorcio", -370, -5, "Renovada", ""],
    ["POL-22455", "LOPEZ RAMIRO", "LA MERCANTIL ANDINA", "Automotores", -380, -15, "No renueva", "Vendió el auto"],
    ["POL-66300", "ESTUDIO CONTABLE RIVAS", "ALLIANZ", "Integral de comercio", -385, -20, "Renovada", ""],
    ["POL-19822", "BENITEZ CARLA", "PROVINCIA SEGUROS", "Automotores", -390, -25, "Renovada", ""],
    ["POL-40155", "SUAREZ MONICA", "LA MERCANTIL ANDINA", "Combinado familiar", -395, -30, "No renueva", "Se mudó de provincia"],
  ];
  let renovaciones = RENOV.map((r, i) => {
    const [poliza, cliente, aseguradora, seccion, ini, fin, estado, observaciones] = r;
    return {
      _dbId: i + 1, id: "REN-" + String(i + 1).padStart(4, "0"), n: i + 1,
      poliza, cliente, aseguradora, seccion,
      inicioVig: dias(ini), finVig: dias(fin), estado, observaciones,
      ultimaModPor: "Demo", ultimaModFecha: diasIso(-(i % 7)), creado: dias(ini), eliminado: false,
    };
  });

  // ============================ PENDIENTES ============================
  const PEND = [
    ["Cotizar flota de Logística del Sur", "Pidieron 6 unidades, comparar con Federación y Sancor", "LOGISTICA DEL SUR SRL", "Cotización", "Alta", 1, "En curso"],
    ["Mandar póliza firmada de Don Pepe", "Falta el endoso del local nuevo", "ALMACEN DON PEPE", "Póliza", "Alta", 0, "Pendiente"],
    ["Reclamar cuota vencida de Textil Moreno", "Segundo aviso, vence el viernes", "TEXTIL MORENO SA", "Cobranza", "Alta", -2, "Pendiente"],
    ["Actualizar sumas aseguradas del consorcio", "Se hizo la obra nueva en el hall", "CONSORCIO BELGRANO 1240", "Póliza", "Media", 6, "Pendiente"],
    ["Pedir CBU actualizado a Gómez", "Cambió de banco", "GOMEZ SILVANA", "Administración", "Baja", 9, "Pendiente"],
    ["Cargar comisiones de agosto", "Falta el detalle de Provincia", "", "Administración", "Media", 3, "En curso"],
    ["Llamar a Quiroga por la renovación", "Quiere bajar la cobertura", "QUIROGA FEDERICO", "Cotización", "Media", 2, "Pendiente"],
    ["Archivar carpetas de siniestros cerrados", "Los del trimestre pasado", "", "Otro", "Baja", 14, "Pendiente"],
    ["Enviar credenciales a Pereyra", "Ya está emitida", "PEREYRA HECTOR", "Póliza", "Media", -4, "Hecho"],
  ];
  let pendientes = PEND.map((p, i) => {
    const [titulo, descripcion, cliente, categoria, prioridad, lim, estado] = p;
    return {
      _dbId: i + 1, id: "PEN-" + String(i + 1).padStart(4, "0"), n: i + 1,
      titulo, descripcion, cliente, categoria, prioridad,
      fechaLimite: dias(lim), estado, asignado: i % 2 ? "Sofía Ferrari" : "Andrés Aguirre", asignadoA: null,
      ultimaModPor: "Demo", ultimaModFecha: diasIso(-(i % 5)), creado: dias(-10 + i), eliminado: false,
    };
  });

  // ============================ SOLICITUDES (denuncias web) ============================
  let solicitudes = [
    { _dbId: 1, id: "SOL-0001", ref: "DEN-4471", nombre: "ACOSTA DANIEL", dniCuit: "27123456", telefono: "11 5544 2211", email: "dacosta@mail.com",
      cia: "La Mercantil Andina", poliza: "516203311", dominio: "AF 220 LM", ramo: "AUTO", tipoSiniestro: "choque",
      terceroNombre: "SOSA MARIELA", terceroDni: "30112233", terceroCelular: "11 6677 8899", terceroDominio: "AC 445 TT", terceroCia: "Provincia", terceroPoliza: "11009988",
      fechaHecho: dias(-1), horaHecho: "08:40", ubicacion: "Av. San Martín y Rivadavia", localidad: "San Isidro",
      lesionados: "NO", relato: "Venía por San Martín y me chocaron de atrás al frenar en el semáforo.",
      adjuntos: [], estado: "nueva", siniestroCodigo: "", creado: diasIso(-1) },
    { _dbId: 2, id: "SOL-0002", ref: "DEN-4470", nombre: "FARIAS LUCIA", dniCuit: "33445566", telefono: "11 4433 2200", email: "lfarias@mail.com",
      cia: "Allianz", poliza: "260220742200", dominio: "", ramo: "HOGAR", tipoSiniestro: "agua",
      terceroNombre: "", terceroDni: "", terceroCelular: "", terceroDominio: "", terceroCia: "", terceroPoliza: "",
      fechaHecho: dias(-2), horaHecho: "19:00", ubicacion: "Belgrano 442, 3° B", localidad: "Vicente López",
      lesionados: "NO", relato: "Se rompió un caño del departamento de arriba y me arruinó el cielorraso del living.",
      adjuntos: [], estado: "nueva", siniestroCodigo: "", creado: diasIso(-2) },
    { _dbId: 3, id: "SOL-0003", ref: "DEN-4468", nombre: "MOLINA ROBERTO", dniCuit: "20998877", telefono: "11 2233 4455", email: "rmolina@mail.com",
      cia: "Provincia Seguros", poliza: "11007744", dominio: "AB 991 KK", ramo: "AUTO", tipoSiniestro: "cristales",
      terceroNombre: "", terceroDni: "", terceroCelular: "", terceroDominio: "", terceroCia: "", terceroPoliza: "",
      fechaHecho: dias(-6), horaHecho: "22:10", ubicacion: "Cochera del edificio", localidad: "Olivos",
      lesionados: "NO", relato: "Apareció el parabrisas rajado, creo que una piedra en la autopista.",
      adjuntos: [], estado: "procesada", siniestroCodigo: "STR-03-DEMO", creado: diasIso(-6) },
  ];

  // ============================ COTIZACIONES (hogar) ============================
  let cotizaciones = [
    { _dbId: 1, id: "COT-0001", ref: "COT-2210", ramo: "HOGAR", nombre: "ROMERO VALERIA", documento: "34556677",
      telefono: "11 6644 3322", email: "vromero@mail.com", direccion: "Los Álamos 1220", localidad: "Tigre", codigoPostal: "1648",
      tipoVivienda: "CASA", piso: "", enCountry: true, tienePileta: true, metros2: 180,
      alarma: true, medidasSeguridad: true, equiposFuera: true, equiposFueraDetalle: "", equiposFueraObjeto: "Notebook",
      equiposFueraMarca: "Lenovo", equiposFueraModelo: "IdeaPad 5", equiposFueraValor: 950000,
      notebookPc: false, notebookPcDetalle: "", notebookPcMarca: "", notebookPcModelo: "", notebookPcValor: null,
      bicicleta: true, bicicletaMarca: "Trek", bicicletaModelo: "Marlin 5", bicicletaValor: 780000,
      roboCelular: true, celularValor: 620000, observaciones: "Quiere cotizar contra lo que tiene hoy en otra compañía.",
      estado: "nueva", notasInternas: "", gestionadaPor: "", creado: diasIso(-1) },
    { _dbId: 2, id: "COT-0002", ref: "COT-2209", ramo: "HOGAR", nombre: "CABRERA MARTIN", documento: "28776655",
      telefono: "11 3322 1100", email: "mcabrera@mail.com", direccion: "Sarmiento 87, 5° A", localidad: "Martínez", codigoPostal: "1640",
      tipoVivienda: "DEPARTAMENTO", piso: "5", enCountry: null, tienePileta: null, metros2: 72,
      alarma: false, medidasSeguridad: true, equiposFuera: false, equiposFueraDetalle: "", equiposFueraObjeto: "",
      equiposFueraMarca: "", equiposFueraModelo: "", equiposFueraValor: null,
      notebookPc: true, notebookPcDetalle: "", notebookPcMarca: "Apple", notebookPcModelo: "MacBook Air", notebookPcValor: 1800000,
      bicicleta: false, bicicletaMarca: "", bicicletaModelo: "", bicicletaValor: null,
      roboCelular: false, celularValor: null, observaciones: "",
      estado: "cotizada", notasInternas: "Cotizado 12/8, espera respuesta.", gestionadaPor: "Sofía Ferrari", creado: diasIso(-5) },
    { _dbId: 3, id: "COT-0003", ref: "COT-2207", ramo: "HOGAR", nombre: "NUÑEZ ESTEBAN", documento: "31445566",
      telefono: "11 7788 9900", email: "enunez@mail.com", direccion: "Rivadavia 3300", localidad: "San Fernando", codigoPostal: "1646",
      tipoVivienda: "CASA", piso: "", enCountry: false, tienePileta: false, metros2: 110,
      alarma: false, medidasSeguridad: false, equiposFuera: false, equiposFueraDetalle: "", equiposFueraObjeto: "",
      equiposFueraMarca: "", equiposFueraModelo: "", equiposFueraValor: null,
      notebookPc: false, notebookPcDetalle: "", notebookPcMarca: "", notebookPcModelo: "", notebookPcValor: null,
      bicicleta: false, bicicletaMarca: "", bicicletaModelo: "", bicicletaValor: null,
      roboCelular: false, celularValor: null, observaciones: "",
      estado: "nueva", notasInternas: "", gestionadaPor: "", creado: diasIso(-9) },
  ];

  // ============================ USUARIOS Y NOTIFICACIONES ============================
  const YO = { id: "demo-user", email: "demo@asesores.com.ar", nombre: "Usuario de demostración", rol: "organizador", estado: "activo", creado: diasIso(-400) };
  let perfiles = [
    YO,
    { id: "demo-2", email: "sofia@asesores.com.ar", nombre: "Sofía Ferrari", rol: "empleado", estado: "activo", creado: diasIso(-300) },
    { id: "demo-3", email: "andres@asesores.com.ar", nombre: "Andrés Aguirre", rol: "empleado", estado: "activo", creado: diasIso(-200) },
    { id: "demo-4", email: "nuevo@asesores.com.ar", nombre: "Camila Ponce", rol: "empleado", estado: "pendiente", creado: diasIso(-1) },
  ];
  let notificaciones = [
    { _dbId: 1, tipo: "solicitud", titulo: "Nueva denuncia web de ACOSTA DANIEL", cuerpo: "Entró por el formulario público", modulo: "solicitudes", referencia: "SOL-0001", leida: false, creado: diasIso(-1) },
    { _dbId: 2, tipo: "vencimiento", titulo: "2 gestiones vencen hoy", cuerpo: "Revisá la agenda de gestiones", modulo: "agenda", referencia: "", leida: false, creado: diasIso(0) },
    { _dbId: 3, tipo: "cotizacion", titulo: "Pedido de cotización de ROMERO VALERIA", cuerpo: "Casa en Tigre, 180 m²", modulo: "com-cotizaciones", referencia: "COT-0001", leida: false, creado: diasIso(-1) },
    { _dbId: 4, tipo: "sistema", titulo: "Camila Ponce espera aprobación", cuerpo: "Se registró en el portal", modulo: "usuarios", referencia: "", leida: true, creado: diasIso(-1) },
  ];

  // ============================ sesión falsa ============================
  let sesion = { user: { id: YO.id, email: YO.email } };
  const oyentes = [];
  const avisar = () => oyentes.forEach((cb) => { try { cb(sesion); } catch (e) { console.error(e); } });

  // ---- utilidades genéricas de colección ----
  const nuevoId = (arr) => arr.reduce((m, x) => Math.max(m, x._dbId || 0), 0) + 1;
  const maxN = (arr) => arr.reduce((m, x) => Math.max(m, x.n || 0), 0);
  function alta(arr, item) { const it = { ...clonar(item), _dbId: nuevoId(arr) }; arr.push(it); return espera(clonar(it)); }
  function baja(arr, item) { const i = arr.findIndex((x) => x._dbId === item._dbId || x.id === item.id); if (i >= 0) arr[i].eliminado = true; return espera(true); }
  function edita(arr, item) {
    const i = arr.findIndex((x) => x._dbId === item._dbId || x.id === item.id);
    if (i >= 0) arr[i] = { ...arr[i], ...clonar(item) };
    return espera(clonar(i >= 0 ? arr[i] : item));
  }
  const vivos = (arr) => espera(clonar(arr.filter((x) => !x.eliminado)));
  const nada = () => null;                        // subscribe: en la demo no hay tiempo real

  window.DB = {
    configured: () => true,

    // siniestros
    list: () => vivos(siniestros),
    create: (it) => alta(siniestros, it),
    update: (it) => edita(siniestros, it),
    remove: (it) => baja(siniestros, it),
    maxN: () => espera(maxN(siniestros)),
    subscribe: nada,

    auth: {
      session: () => espera(sesion),
      onChange: (cb) => { oyentes.push(cb); return () => { const i = oyentes.indexOf(cb); if (i >= 0) oyentes.splice(i, 1); }; },
      // En la demo entra cualquier mail y contraseña: es para mostrar la pantalla.
      signIn: (email) => { sesion = { user: { id: YO.id, email: email || YO.email } }; avisar(); return espera({ user: sesion.user }); },
      signOut: () => { sesion = null; avisar(); return espera(true); },
      signUp: () => espera({ user: null }),
      updatePassword: () => espera(true),
    },
    perfiles: {
      me: () => espera(sesion ? clonar(YO) : null),
      list: () => espera(clonar(perfiles)),
      update: (id, patch) => {
        const i = perfiles.findIndex((p) => p.id === id);
        if (i >= 0) perfiles[i] = { ...perfiles[i], ...patch };
        return espera(clonar(perfiles[i]));
      },
      subscribe: nada,
    },
    notif: {
      list: () => espera(clonar(notificaciones)),
      markRead: (id) => { const n = notificaciones.find((x) => x._dbId === id); if (n) n.leida = true; return espera(true); },
      markAll: () => { notificaciones.forEach((n) => { n.leida = true; }); return espera(true); },
      subscribe: nada,
    },
    fact: {
      companias: {
        list: () => espera(clonar(companias)),
        create: (it) => { const nu = { ...clonar(it), id: nuevoId(companias.map((c) => ({ _dbId: c.id }))) }; companias.push(nu); return espera(clonar(nu)); },
        update: (it) => { const i = companias.findIndex((c) => c.id === it.id); if (i >= 0) companias[i] = { ...companias[i], ...clonar(it) }; return espera(clonar(companias[i])); },
        remove: (it) => { companias = companias.filter((c) => c.id !== it.id); mensual = mensual.filter((m) => m.companiaId !== it.id); return espera(true); },
      },
      mensual: {
        list: (anio) => espera(clonar(anio ? mensual.filter((m) => m.anio === anio) : mensual)),
        save: (it) => {
          const i = mensual.findIndex((m) => m.companiaId === it.companiaId && m.anio === it.anio && m.mes === it.mes);
          if (i >= 0) { mensual[i] = { ...mensual[i], ...clonar(it) }; return espera(clonar(mensual[i])); }
          const nu = { ...clonar(it), _dbId: nuevoId(mensual) };
          mensual.push(nu);
          return espera(clonar(nu));
        },
        remove: (it) => { mensual = mensual.filter((m) => m._dbId !== it._dbId); return espera(true); },
      },
      subscribe: nada,
    },
    renov: {
      list: () => vivos(renovaciones), create: (it) => alta(renovaciones, it), update: (it) => edita(renovaciones, it),
      remove: (it) => baja(renovaciones, it), maxN: () => espera(maxN(renovaciones)), subscribe: nada,
    },
    pend: {
      list: () => vivos(pendientes), create: (it) => alta(pendientes, it), update: (it) => edita(pendientes, it),
      remove: (it) => baja(pendientes, it), maxN: () => espera(maxN(pendientes)), subscribe: nada,
    },
    obj: {
      list: () => vivos(objetivos), create: (it) => alta(objetivos, it), update: (it) => edita(objetivos, it),
      remove: (it) => baja(objetivos, it), maxN: () => espera(maxN(objetivos)), subscribe: nada,
    },
    sol: { list: () => espera(clonar(solicitudes)), update: (it) => edita(solicitudes, it), subscribe: nada },
    cot: { list: () => espera(clonar(cotizaciones)), update: (it) => edita(cotizaciones, it), subscribe: nada },
    // Sin `files`: en la demo no se suben adjuntos (el formulario esconde esa parte solo).
  };
})();
