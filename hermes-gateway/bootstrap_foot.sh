
echo "==> [4/6] Setting ownership and permissions"
chown -R hermes:hermes "$APP_DIR"
chmod 750 "$APP_DIR"
chmod 640 "$APP_DIR/hermes.py" "$APP_DIR/config.yaml" "$APP_DIR/.env" "$APP_DIR/monitor.html"

echo "==> [5/6] Installing systemd unit"
cp "$APP_DIR/hermes.service" /etc/systemd/system/"$SVC_NAME"
systemctl daemon-reload
systemctl enable "$SVC_NAME"
systemctl restart "$SVC_NAME"
sleep 2
systemctl --no-pager --full status "$SVC_NAME" || true

echo "==> [6/6] Smoke tests"
PORT=$(grep -E '^HERMES_PORT=' "$APP_DIR/.env" | head -1 | cut -d= -f2 | tr -d '\r')
PORT=${PORT:-3000}
echo "--- GET /health (Hermes-native) ---"
curl -sS --max-time 10 "http://127.0.0.1:${PORT}/health" || echo "(health check failed)"
echo
echo "--- GET / (service index) ---"
curl -sS --max-time 10 "http://127.0.0.1:${PORT}/" || echo "(index check failed)"
echo
echo "--- GET /metrics (telemetry) ---"
curl -sS --max-time 10 "http://127.0.0.1:${PORT}/metrics" || echo "(metrics check failed)"
echo
echo "--- GET /monitor (dashboard, first 3 lines) ---"
curl -sS --max-time 10 "http://127.0.0.1:${PORT}/monitor" | head -3 || echo "(monitor check failed)"
echo
echo
echo "==============================================================="
echo " Hermes installed and running."
echo "   service : systemctl status $SVC_NAME"
echo "   logs    : journalctl -u $SVC_NAME -f"
echo "   health  : curl http://127.0.0.1:${PORT}/health"
echo
echo " Routed request (goes to nvidia / intel-arc automatically):"
echo "   curl -s http://127.0.0.1:${PORT}/v1/chat/completions \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"model\":\"llama-3\",\"max_tokens\":8,\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}]}'"
echo
echo " Force a specific backend:"
echo "   ... -H 'X-Hermes-Backend: nvidia'   (or: intel-arc)"
echo
echo " Telemetry + dashboard:"
echo "   curl -s http://127.0.0.1:${PORT}/metrics"
echo "   open http://192.168.1.120:${PORT}/monitor   (live traffic split + health)"
echo "==============================================================="