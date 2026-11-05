#!/usr/bin/env bash
# =============================================================================
# Hermes — one-shot installer for a Proxmox LXC (Debian / Ubuntu)
#
# Usage (as root inside the container):
#   bash bootstrap.sh
#
# This script is idempotent and fully self-contained: it embeds every
# application file (no git clone, no pip install, no network needed), creates
# an unprivileged 'hermes' user, installs the systemd unit, and starts the
# service. Safe to re-run to re-apply changes.
# =============================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run as root ->  bash bootstrap.sh" >&2
  exit 1
fi

APP_DIR=/opt/hermes
SVC_NAME=hermes.service

echo "==> [1/6] Ensuring python3 is available"
if ! command -v python3 >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y python3
fi
python3 --version

echo "==> [2/6] Creating service account 'hermes'"
if ! id hermes >/dev/null 2>&1; then
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin hermes
fi

echo "==> [3/6] Writing application files to $APP_DIR"
mkdir -p "$APP_DIR"