# Makefile for Sketchboard

.PHONY: setup dev test lint build

setup:
	npm install

dev:
	npm run dev

test:
	npm run test

lint:
	npm run lint

build:
	npm run build
