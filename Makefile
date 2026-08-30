.PHONY: install dev-web dev-api build lint format-check test typecheck verify

install:
	npm ci
	python3 -m venv .venv
	.venv/bin/pip install -e 'apps/api[dev]'

dev-web:
	npm run dev:web

dev-api:
	.venv/bin/uvicorn app.main:app --reload --app-dir apps/api

build:
	npm run build

lint:
	npm run lint

format-check:
	npm run format:check

test:
	npm test

typecheck:
	npm run typecheck

verify: lint format-check typecheck test build
