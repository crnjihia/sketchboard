#!/usr/bin/env bash
# ==============================================================================
# Sketchboard Kubernetes (Kind) Automated Smoke Test
# ==============================================================================
set -euo pipefail

CLUSTER_NAME="sketchboard-smoke"

echo "=== [1/6] Validating prerequisites (docker, kind, kubectl) ==="
command -v docker >/dev/null 2>&1 || { echo "Docker is required"; exit 1; }
command -v kind >/dev/null 2>&1 || { echo "kind is required"; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required"; exit 1; }

echo "=== [2/6] Building local container images ==="
docker build -f Dockerfile.server -t ghcr.io/sketchboard/server:latest .
docker build -f Dockerfile.web -t ghcr.io/sketchboard/web:latest .

echo "=== [3/6] Booting 2-worker node Kind cluster ==="
if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  echo "Cluster ${CLUSTER_NAME} already exists."
else
  kind create cluster --name "${CLUSTER_NAME}" --config deploy/k8s/kind-config.yaml
fi

echo "=== [4/6] Loading local images into Kind nodes ==="
kind load docker-image ghcr.io/sketchboard/server:latest --name "${CLUSTER_NAME}"
kind load docker-image ghcr.io/sketchboard/web:latest --name "${CLUSTER_NAME}"

echo "=== [5/6] Deploying Sketchboard manifests via Kustomize ==="
kubectl apply -k deploy/k8s

echo "Waiting for Sketchboard pods to become Ready..."
kubectl rollout status deployment/sketchboard-server -n sketchboard --timeout=120s
kubectl rollout status deployment/sketchboard-web -n sketchboard --timeout=120s

echo "Verifying liveness of server replicas..."
kubectl get pods -n sketchboard -o wide

echo "=== [6/6] Smoke test PASSED: Cluster is operational! ==="
echo "To clean up: kind delete cluster --name ${CLUSTER_NAME}"
