#!/usr/bin/env bash
# RELEASE d'un feature (el fa el DEVELOPER quan crea una versió, NO l'installer):
#   1. valida el manifest
#   2. construeix i puja la imatge ÚNICA a ghcr (API + UI embeguda)
#   3. talla el tag v<version> i el puja
# L'installer (devops.installer) només baixa la imatge i desplega.
#
# Ús: bash scripts/release.sh [--push-images] [--push-tag]
#   Requereix: docker + docker login ghcr.io (PAT amb package:write) + git remote.
set -euo pipefail

RELEASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RELEASE_DIR"

PUSH_IMAGES=0
PUSH_TAG=0
for arg in "$@"; do
  case "$arg" in
    --push-images) PUSH_IMAGES=1 ;;
    --push-tag) PUSH_TAG=1 ;;
  esac
done

# 1. Dades del manifest
VERSION="$(node -e "const Y=require('yaml'),fs=require('fs');console.log(Y.parse(fs.readFileSync('gaudi-feature.yaml','utf8')).version)")"
ID="$(node -e "const Y=require('yaml'),fs=require('fs');console.log(Y.parse(fs.readFileSync('gaudi-feature.yaml','utf8')).id)")"
SLUG="$(basename "$PWD" | sed 's/^gaudi-//')"
IMAGE_BASE="${GHCR_IMAGE_BASE:-ghcr.io/2mes4-gaudi/gaudi-$SLUG}"
TAG="v$VERSION"

echo "→ Release $ID v$VERSION (tag $TAG)"

# 2. Build de la imatge ÚNICA (API + UI embeguda, si el manifest les declara)
if [ -f Dockerfile ]; then
  echo "  imatge: $IMAGE_BASE:$VERSION"
  docker build -t "$IMAGE_BASE:$VERSION" -f Dockerfile .
fi

# 3. Push (developer amb PAT)
if [ "$PUSH_IMAGES" = "1" ]; then
  echo "→ Autenticant a ghcr.io (token: gh auth token o PAT amb package:write)..."
  echo "$(gh auth token 2>/dev/null || echo "${GHCR_PAT:-}")" | docker login ghcr.io -u "${GHCR_USER:-$(gh api user -q .login 2>/dev/null || echo 2mes4)}" --password-stdin
  [ -f Dockerfile ] && docker push "$IMAGE_BASE:$VERSION"
fi

# 4. Tag + push
if [ "$PUSH_TAG" = "1" ]; then
  git tag "$TAG"
  git push origin "$TAG"
fi

echo "✓ Release $ID v$VERSION llesta"
[ "$PUSH_IMAGES" = "0" ] && echo "  (--push-images per pujar la imatge a ghcr)"
[ "$PUSH_TAG" = "0" ] && echo "  (--push-tag per tallar el tag $TAG)"
