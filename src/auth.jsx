// auth.jsx — Acceso al portal (Supabase Auth)
// Ingreso con contraseña, acceso por Magic Link y registro con email real.
// Los registros nuevos quedan PENDIENTES hasta que un organizador los apruebe.

// De qué empresa es esta pantalla, resuelto SIN sesión por el slug de la
// dirección. Lo usan el login y la pantalla de "cuenta pendiente", que son las
// dos que se ven antes de que el portal sepa quién entró.
function useEmpresaPublica() {
  const [empresa, setEmpresa] = React.useState(null);
  // `resuelto` no se lee: está para volver a dibujar cuando la consulta termina
  // sin empresa. Ahí el logo pasa de "esperando" a lo que corresponda, que en
  // una base sin multiempresa es el archivo del repositorio.
  const [, setResuelto] = React.useState(false);
  React.useEffect(() => {
    if (!(window.DB && window.DB.configured() && window.DB.org && window.DB.org.publica)) return;
    let vivo = true;
    (async () => {
      const o = await window.DB.org.publica(window.ORG_SLUG);
      if (!vivo) return;
      setResuelto(true);
      if (!o) return;
      setEmpresa(o);
      window.aplicarMarca({ ...(o.marca || {}), nombre: o.nombre });
    })();
    return () => { vivo = false; };
  }, []);
  return empresa;
}

// El logo de la empresa dueña de esta dirección, o su nombre escrito si todavía
// no subió ninguno. Mientras no se resuelve no se muestra nada: un parpadeo con
// el logo de otro broker es justo lo que no puede pasar. Sin base configurada
// (modo demostración) vuelve el archivo del repositorio.
function LoginMarca({ empresa }) {
  // Mientras no se resuelve no se muestra nada, salvo que la base no tenga
  // multiempresa: ahí la única empresa es la de casa y el archivo es su logo.
  const unaSolaEmpresa = window.MULTIEMPRESA === false || !(window.DB && window.DB.configured());
  const logo = empresa ? (empresa.marca || {}).logo : (unaSolaEmpresa ? "/assets/saraceni-logo.jpg" : "");
  if (logo) return <div className="login-logo"><img src={logo} alt={(empresa && empresa.nombre) || "Portal"} /></div>;
  if (empresa && empresa.nombre) return <div className="login-logo login-logo-texto">{empresa.nombre}</div>;
  return <div className="login-logo login-logo-vacio" aria-hidden="true" />;
}

// Las tres líneas del panel.
//
// ⚠️ No se arman con los módulos que contrató el broker, aunque suene mejor.
// Lo único que se sabe sin sesión es lo que devuelve `org_publica`, y eso son
// los módulos con formulario PÚBLICO —siniestros y comercial—, no los que
// compró. Usándolos, a Aicardi le prometíamos renovaciones y un panel
// comercial que no tiene, y a Saraceni le escondíamos cuatro de los seis.
//
// Así que dicen lo que el portal hace para cualquiera que entre, sin nombrar
// un módulo que el que mira capaz no compró.
const LOGIN_PUNTOS = [
  { icon: "shield", txt: "Cada siniestro con su estado y su vencimiento" },
  { icon: "check", txt: "Tu equipo sabe qué tiene que hacer hoy" },
  { icon: "phone", txt: "Tus asegurados denuncian desde el celular" },
];

function LoginPanel({ empresa }) {
  const puntos = LOGIN_PUNTOS;
  return (
    <aside className="login-panel">
      <div className="login-panel-top">
        <LoginMarca empresa={empresa} />
      </div>
      <div className="login-panel-mid">
        <h2>Tu cartera, ordenada</h2>
        <p>Siniestros, vencimientos y gestiones del día en un solo lugar. Tu equipo y tus asegurados, al tanto.</p>
        <ul className="login-puntos">
          {puntos.map((p) => (
            <li key={p.txt}><span className="login-punto-ico"><Ico name={p.icon} size={15} /></span>{p.txt}</li>
          ))}
        </ul>
      </div>
      <div className="login-panel-pie">{(empresa && empresa.nombre) || "PAS360"}</div>
    </aside>
  );
}

function LoginScreen({ onSignIn }) {
  const [mode, setMode] = React.useState("login"); // login | signup | olvide
  const empresa = useEmpresaPublica();
  const [verPass, setVerPass] = React.useState(false);
  const [nombre, setNombre] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [err, setErr] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const switchMode = (m) => { setMode(m); setErr(""); setInfo(""); };

  const submit = async (e) => {
    if (e) e.preventDefault();
    setErr(""); setInfo(""); setBusy(true);
    try {
      if (mode === "olvide") {
        await window.DB.auth.resetPassword(email.trim());
        // Se contesta lo mismo exista o no la cuenta: si dijera "ese email no
        // está registrado", cualquiera podría averiguar quién trabaja acá
        // probando direcciones.
        setInfo("Si ese email tiene una cuenta, te llega un mensaje con el link para elegir una nueva contraseña. Revisá el correo no deseado.");
        setBusy(false);
      } else if (mode === "login") {
        await onSignIn(email.trim(), pass);
        // App detecta la sesión y reemplaza esta pantalla
      } else {
        if (pass.length < 8) { setErr("La contraseña debe tener al menos 8 caracteres."); setBusy(false); return; }
        const data = await window.DB.auth.signUp(email.trim(), pass, nombre.trim());
        if (data && data.session) {
          setInfo("Cuenta creada. Un organizador debe aprobar tu acceso.");
        } else {
          setInfo("Cuenta creada. Confirmá tu email desde el link que te enviamos y esperá la aprobación de un organizador.");
        }
        setBusy(false);
      }
    } catch (ex) {
      console.error(ex);
      const m = String((ex && ex.message) || "");
      if (m.includes("rate limit") || m.includes("Too Many")) {
        setErr("Se mandaron muchos mails seguidos. Esperá unos minutos y probá de nuevo.");
      } else if (mode === "olvide") setErr("No se pudo enviar el mail. Revisá la dirección e intentá de nuevo.");
      else if (mode === "login") setErr("Email o contraseña incorrectos.");
      else if (m.includes("already registered")) setErr("Ese email ya tiene una cuenta. Probá ingresar.");
      else setErr("No se pudo crear la cuenta. Revisá el email e intentá de nuevo.");
      setBusy(false);
    }
  };

  const canSubmit = mode === "signup" ? !!(email && pass && nombre)
    : mode === "olvide" ? !!email
    : !!(email && pass);

  const titulo = mode === "signup" ? "Creá tu cuenta"
    : mode === "olvide" ? "Recuperar el acceso"
    : "Bienvenido de vuelta";
  const bajada = mode === "signup" ? "Con tu email de trabajo"
    : mode === "olvide" ? "Te mandamos un link para elegir una contraseña nueva"
    : "Ingresá a tu cuenta para continuar";

  return (
    <div className="login">
      <LoginPanel empresa={empresa} />

      <div className="login-lado">
        <form className="login-form" onSubmit={submit}>
          {/* El logo se repite acá solo en pantalla chica, donde el panel de la
              izquierda no entra y si no quedaría sin marca ninguna. */}
          <div className="login-marca-chica"><LoginMarca empresa={empresa} /></div>

          <h1 className="login-title">{titulo}</h1>
          <p className="login-sub">{bajada}</p>

          {window.AMBIENTE === "test" && (
            <div className="login-ambiente">
              <Ico name="alert" size={14} />
              <span><b>Ambiente de prueba.</b> Esta pantalla usa una base separada: lo que cargues acá no toca el portal real.</span>
            </div>
          )}

          {mode === "signup" && (
            <label className="login-field">
              <span>Nombre y apellido</span>
              <input className="input" type="text" autoComplete="name" autoFocus
                value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan Pérez" />
            </label>
          )}

          <label className="login-field">
            <span>Email</span>
            <input className="input" type="email" autoComplete="username" autoFocus={mode !== "signup"}
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          </label>

          {mode !== "olvide" && (
            <label className="login-field">
              <span>Contraseña</span>
              <span className="login-pass">
                <input className="input" type={verPass ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={pass} onChange={(e) => setPass(e.target.value)}
                  placeholder={mode === "signup" ? "Mínimo 8 caracteres" : "••••••••"} />
                {/* Escribir una contraseña a ciegas en el celular es la causa
                    número uno de "no me anda la clave". */}
                <button type="button" className="login-ojo" onClick={() => setVerPass((v) => !v)}
                  title={verPass ? "Ocultar" : "Mostrar"} aria-label={verPass ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  <Ico name={verPass ? "eyeOff" : "eye"} size={17} />
                </button>
              </span>
            </label>
          )}

          {mode === "login" && (
            <div className="login-linea">
              <button type="button" className="login-link" onClick={() => switchMode("olvide")}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          {err && <div className="login-err">{err}</div>}
          {info && <div className="login-info">{info}</div>}

          <button className="btn-primary login-btn" type="submit" disabled={busy || !canSubmit}>
            {busy ? "Un momento…"
              : mode === "signup" ? "Crear cuenta"
              : mode === "olvide" ? "Mandame el link"
              : "Iniciar sesión"}
          </button>

          <div className="login-cambiar">
            {mode === "login" && <>¿No tenés cuenta? <button type="button" className="login-link" onClick={() => switchMode("signup")}>Registrate</button></>}
            {mode === "signup" && <>¿Ya tenés cuenta? <button type="button" className="login-link" onClick={() => switchMode("login")}>Ingresá</button></>}
            {mode === "olvide" && <button type="button" className="login-link" onClick={() => switchMode("login")}>Volver al ingreso</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

// La pantalla a la que cae el que volvió desde el mail de recuperación.
// Supabase ya le dejó una sesión válida en el link, así que acá solo se elige
// la contraseña nueva: NO se le pide la vieja, que es justo la que no recuerda.
function ResetPassScreen({ onListo }) {
  const empresa = useEmpresaPublica();
  const [p1, setP1] = React.useState("");
  const [p2, setP2] = React.useState("");
  const [ver, setVer] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setErr("");
    if (p1.length < 8) { setErr("La contraseña debe tener al menos 8 caracteres."); return; }
    if (p1 !== p2) { setErr("Las dos contraseñas no coinciden."); return; }
    setBusy(true);
    try { await window.DB.auth.updatePassword(p1); onListo(); }
    catch (ex) {
      console.error(ex);
      setErr("El link puede haber vencido. Pedí uno nuevo desde “¿Olvidaste tu contraseña?”.");
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <LoginPanel empresa={empresa} />
      <div className="login-lado">
        <form className="login-form" onSubmit={submit}>
          <div className="login-marca-chica"><LoginMarca empresa={empresa} /></div>
          <h1 className="login-title">Elegí tu nueva contraseña</h1>
          <p className="login-sub">Con esta vas a entrar de ahora en más</p>

          <label className="login-field">
            <span>Nueva contraseña</span>
            <span className="login-pass">
              <input className="input" type={ver ? "text" : "password"} autoComplete="new-password" autoFocus
                value={p1} onChange={(e) => setP1(e.target.value)} placeholder="Mínimo 8 caracteres" />
              <button type="button" className="login-ojo" onClick={() => setVer((v) => !v)}
                aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}>
                <Ico name={ver ? "eyeOff" : "eye"} size={17} />
              </button>
            </span>
          </label>
          <label className="login-field">
            <span>Repetila</span>
            <input className="input" type={ver ? "text" : "password"} autoComplete="new-password"
              value={p2} onChange={(e) => setP2(e.target.value)} />
          </label>

          {err && <div className="login-err">{err}</div>}

          <button className="btn-primary login-btn" type="submit" disabled={busy || !p1 || !p2}>
            {busy ? "Guardando…" : "Guardar y entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Cuenta creada pero sin acceso todavía (pendiente de aprobación o suspendida)
function PendingScreen({ perfil, email, onLogout, onRefresh }) {
  const empresa = useEmpresaPublica();
  const suspendida = perfil && perfil.estado === "suspendido";
  return (
    <div className="login">
      <LoginPanel empresa={empresa} />
      <div className="login-lado">
        <div className="login-form">
          <div className="login-marca-chica"><LoginMarca empresa={empresa} /></div>
          <h1 className="login-title">{suspendida ? "Acceso suspendido" : "Falta que te aprueben"}</h1>
          <p className="login-sub">
            {suspendida
              ? "Tu usuario fue suspendido por un organizador. Si creés que es un error, contactá a la oficina."
              : "Tu cuenta ya está creada, pero un organizador tiene que habilitarla antes de que puedas ver el portal. Apenas te aprueben, entrás con este mismo email."}
          </p>
          <div className="login-info">{email}</div>
          {!suspendida && <button className="btn-primary login-btn" type="button" onClick={onRefresh}>Ya me aprobaron — reintentar</button>}
          <button className="btn-ghost login-salir" type="button" onClick={onLogout}>
            <Ico name="logout" size={15} />Salir
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal para que cada usuario cambie su propia contraseña
function ChangePassModal({ onClose, onDone }) {
  const [p1, setP1] = React.useState("");
  const [p2, setP2] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = async (e) => {
    if (e) e.preventDefault();
    setErr("");
    if (p1.length < 8) { setErr("La contraseña debe tener al menos 8 caracteres."); return; }
    if (p1 !== p2) { setErr("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try { await window.DB.auth.updatePassword(p1); onDone(); }
    catch (ex) { console.error(ex); setErr("No se pudo cambiar la contraseña. Probá de nuevo."); setBusy(false); }
  };
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <form className="modal modal-sm" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <div><h2>Cambiar contraseña</h2><p>Elegí una nueva contraseña para tu usuario</p></div>
          <button type="button" className="btn-ghost tb-icon" onClick={onClose}><Ico name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field field-full">
              <span className="field-label">Nueva contraseña</span>
              <input className="input" type="password" autoComplete="new-password" autoFocus
                value={p1} onChange={(e) => setP1(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </label>
            <label className="field field-full">
              <span className="field-label">Repetir contraseña</span>
              <input className="input" type="password" autoComplete="new-password"
                value={p2} onChange={(e) => setP2(e.target.value)} />
            </label>
            {err && <div className="login-err field-full">{err}</div>}
          </div>
        </div>
        <div className="modal-foot">
          <span className="foot-note"><Ico name="shield" size={14} /> Vale desde tu próximo ingreso</span>
          <div className="foot-btns">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy || !p1 || !p2}>{busy ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

Object.assign(window, { LoginScreen, PendingScreen, ChangePassModal, ResetPassScreen });

// Marca este archivo como modulo ES. Sin esto el compilador lo toma por
// script (no tiene ningun import/export todavia) y compila el JSX a require(),
// que en el navegador no existe. Se va cuando el archivo tenga imports de verdad.
export {};
