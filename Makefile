.PHONY: dev build test lint format docker-up docker-down docker-build backup restore deploy setup clean

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

format:
	pnpm format

format-check:
	pnpm format:check

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-ps:
	docker compose ps

backup:
	bash scripts/backup.sh

restore:
	bash scripts/restore.sh

deploy:
	bash scripts/deploy.sh

setup:
	bash scripts/setup.sh

clean:
	docker compose down -v
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/web/.next apps/server/dist apps/*/dist

install:
	pnpm install

prune:
	docker system prune -f
	docker volume prune -f
