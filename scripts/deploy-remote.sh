#!/usr/bin/env bash
#
# Put a published image on the box and prove it took. The same shape as the
# cloud's scripts/deploy-remote.sh (US-075 there).
#
#   scripts/deploy-remote.sh <host> <image@sha256:…>
#
# The compose file travels with the image; `.env` does not, because it holds
# the box's own secrets.

set -euo pipefail

host=${1:?the box to deploy to}
image=${2:?a digest reference: repository@sha256:…}
directory=/root/signalscout-radar
project=signalscout-radar

ssh_options=(-o BatchMode=yes -o ConnectTimeout=15)
remote="root@${host}"
compose="RADAR_IMAGE='${image}' docker compose -p ${project} -f docker-compose.prod.yml"

echo "==> Sending the compose file from this commit"
ssh "${ssh_options[@]}" "$remote" "mkdir -p '$directory'"
scp "${ssh_options[@]}" -q docker-compose.prod.yml "${remote}:${directory}/"

if [ -n "${REGISTRY_TOKEN:-}" ]; then
  echo "==> Logging the box in to the registry"
  printf '%s' "$REGISTRY_TOKEN" | ssh "${ssh_options[@]}" "$remote" \
    "docker login ghcr.io -u '${REGISTRY_USER:?the registry user}' --password-stdin"
fi

echo "==> Pulling and starting"
ssh "${ssh_options[@]}" "$remote" "cd '$directory' && ${compose} pull -q && ${compose} up -d --remove-orphans"

echo "==> Waiting for the web process to report healthy"
ssh "${ssh_options[@]}" "$remote" "
  for _ in \$(seq 1 30); do
    state=\$(docker inspect -f '{{.State.Health.Status}}' '${project}-web-1' 2>/dev/null || echo missing)
    [ \"\$state\" = healthy ] && exit 0
    sleep 2
  done
  echo \"web never became healthy; last state: \$state\" >&2
  docker logs --tail 40 '${project}-web-1' >&2 || true
  exit 1
"

expected=${image##*@}
for service in web worker; do
  running=$(ssh "${ssh_options[@]}" "$remote" "docker inspect -f '{{.Image}}' '${project}-${service}-1'")
  if [ "$running" != "$expected" ]; then
    echo "${service} is running ${running}, not ${expected}" >&2
    exit 1
  fi
done
echo "==> ${project} is running the build this run produced"
