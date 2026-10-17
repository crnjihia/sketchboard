# Makefile for Sketchboard
.PHONY: setup dev dev-web dev-server test lint build clean

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

lint:
	pnpm lint

build:
	pnpm build

clean:
	pnpm clean
