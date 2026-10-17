# Makefile for Sketchboard
.PHONY: setup dev dev-web dev-server test test-chaos test-load test-e2e seed lint build compose-up compose-down k8s-up k8s-down clean

setup:
	pnpm install
	pnpm approve-builds --all

dev:
	pnpm dev

dev-web:
	pnpm dev:web

dev-server:
	pnpm dev:server

test:
	pnpm test

test-chaos:
	pnpm test:chaos

test-load:
	pnpm test:load

test-e2e:
	pnpm test:e2e

seed:
	pnpm seed

lint:
	pnpm lint

build:
	pnpm build

compose-up:
	docker compose up --build -d
	@echo "Sketchboard running at http://localhost:8080 (balanced across server-1 and server-2)"

compose-down:
	docker compose down -v

k8s-up:
	kubectl apply -k deploy/k8s
	@echo "Sketchboard deployed to Kubernetes (namespace: sketchboard)"

k8s-down:
	kubectl delete -k deploy/k8s

k8s-smoke:
	bash scripts/kind-smoke-test.sh

clean:
	pnpm clean
