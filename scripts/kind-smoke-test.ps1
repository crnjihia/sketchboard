# ==============================================================================
# Sketchboard Kubernetes (Kind) Automated Smoke Test (PowerShell)
# ==============================================================================
$ErrorActionPreference = "Stop"
$ClusterName = "sketchboard-smoke"

Write-Host "=== [1/6] Validating prerequisites (docker, kind, kubectl) ===" -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker is required." }
if (-not (Get-Command kind -ErrorAction SilentlyContinue)) { throw "Kind is required." }
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) { throw "Kubectl is required." }

Write-Host "=== [2/6] Building local container images ===" -ForegroundColor Cyan
docker build -f Dockerfile.server -t ghcr.io/sketchboard/server:latest .
docker build -f Dockerfile.web -t ghcr.io/sketchboard/web:latest .

Write-Host "=== [3/6] Booting 2-worker node Kind cluster ===" -ForegroundColor Cyan
$existingClusters = kind get clusters
if ($existingClusters -contains $ClusterName) {
    Write-Host "Cluster $ClusterName already exists."
} else {
    kind create cluster --name $ClusterName --config deploy/k8s/kind-config.yaml
}

Write-Host "=== [4/6] Loading local images into Kind nodes ===" -ForegroundColor Cyan
kind load docker-image ghcr.io/sketchboard/server:latest --name $ClusterName
kind load docker-image ghcr.io/sketchboard/web:latest --name $ClusterName

Write-Host "=== [5/6] Deploying Sketchboard manifests via Kustomize ===" -ForegroundColor Cyan
kubectl apply -k deploy/k8s

Write-Host "Waiting for deployments to roll out..." -ForegroundColor Cyan
kubectl rollout status deployment/sketchboard-server -n sketchboard --timeout=120s
kubectl rollout status deployment/sketchboard-web -n sketchboard --timeout=120s

Write-Host "Cluster Pod State:" -ForegroundColor Green
kubectl get pods -n sketchboard -o wide

Write-Host "=== [6/6] Smoke test PASSED: Cluster is operational! ===" -ForegroundColor Green
Write-Host "To clean up: kind delete cluster --name $ClusterName"
