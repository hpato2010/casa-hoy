#!/bin/bash
# Casa Hoy · abre la app a tu red Wi-Fi para verla desde el celular.
# El Mac y el celular deben estar en la misma red.

set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "No se encontró python3."
  exit 1
fi

PORT=8765
for ((attempt = 0; attempt < 30; attempt++)); do
  if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  PORT=$((PORT + 1))
done

IFACE=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
IP=""
if [ -n "$IFACE" ]; then
  IP=$(ipconfig getifaddr "$IFACE" 2>/dev/null || true)
fi
if [ -z "$IP" ]; then
  IP=$(ipconfig getifaddr en0 2>/dev/null || true)
fi

echo "🏡 Casa Hoy en tu red local"
echo ""
if [ -n "$IP" ]; then
  echo "  Abre en el celular:  http://$IP:$PORT/"
  echo ""
  echo "  Si no carga, revisa que el celular esté en la misma Wi-Fi."
  echo "  Si macOS pregunta si permites conexiones entrantes para Python, acepta."
else
  echo "  No pude detectar la IP del Mac. Revísala en Ajustes → Wi-Fi → Detalles."
fi
echo ""
echo "  En este Mac: http://127.0.0.1:$PORT/"
echo ""
echo "  Mantén esta ventana abierta mientras usas la app en el celular."
echo "  Pulsa Ctrl+C o cierra la ventana para detenerla."
echo ""

python3 -m http.server "$PORT" --bind 0.0.0.0 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM

sleep 1
wait "$SERVER_PID"
