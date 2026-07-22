// auth.jsx — Pantalla de inicio de sesión (Supabase Auth)

function LoginScreen({ onSignIn }) {
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await onSignIn(email.trim(), pass);
      // si funciona, App detecta la sesión y reemplaza esta pantalla
    } catch (ex) {
      console.error(ex);
      setErr("Email o contraseña incorrectos.");
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo"><img src="assets/saraceni-logo.jpg" alt="Saraceni Seguros" /></div>
        <h1 className="login-title">Portal de Siniestros</h1>
        <p className="login-sub">Ingresá para continuar</p>

        <label className="login-field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="username" autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="oficina@saraceni.app" />
        </label>
        <label className="login-field">
          <span>Contraseña</span>
          <input className="input" type="password" autoComplete="current-password"
            value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" />
        </label>

        {err && <div className="login-err">{err}</div>}

        <button className="btn-primary login-btn" type="submit" disabled={busy || !email || !pass}>
          {busy ? "Ingresando…" : "Ingresar"}
        </button>

        <div className="login-foot">SARACENI · Broker de Seguros</div>
      </form>
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

Object.assign(window, { LoginScreen, ChangePassModal });
