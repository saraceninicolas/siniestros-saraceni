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

Object.assign(window, { LoginScreen });
