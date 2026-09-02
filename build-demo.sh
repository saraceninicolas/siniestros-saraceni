#!/bin/bash
# build-demo.sh — Arma `demo.html`, un único archivo con TODO adentro.
# ─────────────────────────────────────────────────────────────────────────────
# Sirve para dos cosas:
#   • mandarle la demo a alguien por mail o WhatsApp: la abre con doble clic
#   • probarla sin servidor (abriendo index.html con file:// no funciona, porque
#     Babel busca los .jsx con fetch y el navegador lo bloquea)
#
# Uso:  bash build-demo.sh
# Necesita conexión solo al abrirlo (React y Babel se bajan del CDN).
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"
OUT="demo.html"
# El logo sale de marca.js, así este script sirve para cualquier marca
LOGO=$(grep -o 'logo: "[^"]*"' marca.js | sed 's/logo: "//; s/"//')
LOGO_B64=$(base64 -w0 "$LOGO")
LOGO_URI="data:image/jpeg;base64,$LOGO_B64"

# 1) El HTML hasta el cierre del <head>, con el logo embebido
sed -n '1,/^<\/head>$/p' index.html \
  | sed 's|<script src="marca.js"></script>||' \
  > "$OUT"

# 2) marca.js y la base falsa, en línea (y el logo como data URI)
{
  echo '<script>'
  sed "s|\"$LOGO\"|\"$LOGO_URI\"|" marca.js
  echo '</script>'
  echo '<body>'
  echo '<div id="root"><div class="boot"><div class="boot-inner"><div class="boot-spin"></div>Cargando…</div></div></div>'
  echo '<script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>'
  echo '<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>'
  echo '<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>'
  echo '<script>'
  cat demo-db.js
  echo '</script>'
} >> "$OUT"

# 3) Todos los .jsx en el mismo orden que index.html
for f in $(grep -o 'src="[a-z-]*\.jsx"' index.html | sed 's/src="//; s/"//'); do
  echo "<script type=\"text/babel\" data-file=\"$f\">" >> "$OUT"
  cat "$f" >> "$OUT"
  echo '</script>' >> "$OUT"
done
echo '</body></html>' >> "$OUT"

echo "OK -> $OUT ($(wc -c < "$OUT") bytes)"
