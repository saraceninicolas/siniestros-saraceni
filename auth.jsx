// auth.jsx — Acceso al portal (Supabase Auth)
// Ingreso con contraseña, acceso por Magic Link y registro con email real.
// Los registros nuevos quedan PENDIENTES hasta que un organizador los apruebe.

function LoginScreen({ onSignIn }) {
  const [mode, setMode] = React.useState("login"); // login | signup | magic
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
      if (mode === "login") {
        await onSignIn(email.trim(), pass);
        // App detecta la sesión y reemplaza esta pantalla
      } else if (mode === "magic") {
        await window.DB.auth.magicLink(email.trim());
        setInfo("Listo. Revisá tu casilla: te mandamos un link para entrar sin contraseña.");
        setBusy(false);
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
      if (mode === "login") setErr("Email o contraseña incorrectos.");
      else if (m.includes("already registered")) setErr("Ese email ya tiene una cuenta. Probá ingresar.");
      else if (m.includes("rate limit")) setErr("Demasiados intentos de envío de email. Esperá unos minutos.");
      else if (mode === "magic") setErr("No se pudo enviar el link. ¿El email está registrado?");
      else setErr("No se pudo crear la cuenta. Revisá el email e intentá de nuevo.");
      setBusy(false);
    }
  };

  const canSubmit = mode === "magic" ? !!email : mode === "signup" ? !!(email && pass && nombre) : !!(email && pass);

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo"><img src="assets/saraceni-logo.jpg" alt="Saraceni Seguros" /></div>
        <h1 className="login-title">Portal de Siniestros</h1>
        <p className="login-sub">{mode === "signup" ? "Creá tu cuenta con tu email" : mode === "magic" ? "Te mandamos un link de acceso" : "Ingresá para continuar"}</p>

        <div className="login-tabs">
          <button type="button" className={"login-tab" + (mode === "login" ? " is-on" : "")} onClick={() => switchMode("login")}>Ingresar</button>
          <button type="button" className={"login-tab" + (mode === "signup" ? " is-on" : "")} onClick={() => switchMode("signup")}>Crear cuenta</button>
        </div>

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
        {mode !== "magic" && (
          <label className="login-field">
            <span>Contraseña</span>
            <input className="input" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={pass} onChange={(e) => setPass(e.target.value)} placeholder={mode === "signup" ? "Mínimo 8 caracteres" : "••••••••"} />
          </label>
        )}

        {err && <div className="login-err">{err}</div>}
        {info && <div className="login-info">{info}</div>}

        <button className="btn-primary login-btn" type="submit" disabled={busy || !canSubmit}>
          {busy ? "Un momento…" : mode === "signup" ? "Crear cuenta" : mode === "magic" ? "Enviarme el link" : "Ingresar"}
        </button>

        {mode === "login" && (
          <button type="button" className="login-magic" onClick={() => switchMode("magic")}>
            Entrar sin contraseña (link por email)
          </button>
        )}
        {mode === "magic" && (
          <button type="button" className="login-magic" onClick={() => switchMode("login")}>
            Volver a ingresar con contraseña
          </button>
        )}

        <div className="login-foot">SARACENI · Broker de Seguros</div>
      </form>
    </div>
  );
}

// Cuenta creada pero sin acceso todavía (pendiente de aprobación o suspendida)
function PendingScreen({ perfil, email, onLogout, onRefresh }) {
  const suspendida = perfil && perfil.estado === "suspendido";
  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo"><img src="assets/saraceni-logo.jpg" alt="Saraceni Seguros" /></div>
        <h1 className="login-title">{suspendida ? "Acceso suspendido" : "Cuenta pendiente de aprobación"}</h1>
        <p className="login-sub" style={{ marginBottom: 14 }}>
          {suspendida
            ? "Tu usuario fue suspendido por un organizador. Si creés que es un error, contactá a la oficina."
            : "Tu cuenta ya está creada, pero un organizador tiene que habilitarla antes de que puedas ver el portal. Apenas te aprueben, entrás con este mismo email."}
        </p>
        <div className="login-info" style={{ marginBottom: 14 }}>{email}</div>
        {!suspendida && <button className="btn-primary login-btn" type="button" onClick={onRefresh}>Ya me aprobaron — reintentar</button>}
        <button className="btn-ghost" type="button" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={onLogout}>
          <Ico name="logout" size={15} />Salir
        </button>
        <div className="login-foot">SARACENI · Broker de Seguros</div>
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

Object.assign(window, { LoginScreen, PendingScreen, ChangePassModal });
