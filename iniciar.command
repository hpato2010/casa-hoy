#!/bin/bash
# Casa Hoy · lanzador local para macOS
# Abre la app en el navegador usando un pequeño servidor local.

set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "No se encontró python3. Abre index.html directamente en Chrome o Firefox."
  exit 1
fi

PORT=8765
for ((attempt = 0; attempt < 30; attempt++)); do
  if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  PORT=$((PORT + 1))
done

echo "Casa Hoy · abriendo en http://127.0.0.1:$PORT/"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM

sleep 1
open "http://127.0.0.1:$PORT/"

echo ""
echo "La app está corriendo. Deja esta ventana abierta mientras la usas."
echo "Pulsa Ctrl+C (o cierra la ventana) para detenerla."
wait "$SERVER_PID"
