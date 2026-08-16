#!/usr/bin/env bash
# Hook de instalación del feature (COMPLEMENTARIO al lifecycle base del core).
# El core ya ha ejecutado: validación del manifest, npm install, npm run build
# y el registro en el catálogo (gaudi feature install). Este hook es el punto
# de entrada para pasos específicos del feature: crear colecciones/tablas que
# declara su manifest, seeds, permisos, etc.
set -euo pipefail

FEATURE_ID="${1:?uso: install.sh <feature_id>}"
echo "→ [hook] install $FEATURE_ID — pasos específicos del feature aquí"
