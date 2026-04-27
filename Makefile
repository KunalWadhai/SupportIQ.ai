# ═══════════════════════════════════════════════════════════════════
#  SupportIQ AI — Developer Makefile
#  Usage: make <target>
# ═══════════════════════════════════════════════════════════════════

.PHONY: help install dev build test lint type-check \
        docker-up docker-down docker-logs docker-reset \
        db-migrate db-seed db-studio db-reset \
        ai-dev api-dev web-dev \
        clean

# ── Detect OS for open command ────────────────────────────────────
ifeq ($(OS),Windows_NT)
  OPEN := start
else
  UNAME := $(shell uname -s)
  ifeq ($(UNAME),Darwin)
    OPEN := open
  else
    OPEN := xdg-open
  endif
endif

# ── Colours ───────────────────────────────────────────────────────
BOLD  := \033[1m
GREEN := \033[32m
CYAN  := \033[36m
RESET := \033[0m

help: ## Show this help message
	@echo ""
	@echo "  $(BOLD)SupportIQ AI$(RESET) — available commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ── Setup ─────────────────────────────────────────────────────────
install: ## Install all Node.js dependencies
	@echo "$(GREEN)Installing dependencies...$(RESET)"
	npm install
	@echo "$(GREEN)Setting up Python venv...$(RESET)"
	cd services/ai-service && python3 -m venv .venv && \
	  .venv/bin/pip install -r requirements.txt -q
	@echo "$(GREEN)✅ All dependencies installed$(RESET)"

env: ## Copy .env.example to .env (won't overwrite existing)
	@[ -f .env ] && echo ".env already exists — skipping" || (cp .env.example .env && echo "✅ .env created — fill in your OPENAI_API_KEY")

# ── Development ───────────────────────────────────────────────────
dev: docker-up db-migrate ## Start full stack in development mode
	@echo "$(GREEN)Starting all services...$(RESET)"
	npm run dev

api-dev: ## Start only the API gateway (needs infra running)
	cd apps/api-gateway && npm run dev

web-dev: ## Start only the Next.js web app
	cd apps/web && npm run dev

ai-dev: ## Start only the Python AI service
	cd services/ai-service && .venv/bin/uvicorn app.main:app --reload --port 8000

# ── Docker ────────────────────────────────────────────────────────
docker-up: ## Start all Docker services (postgres, redis, qdrant, minio)
	@echo "$(GREEN)Starting infrastructure...$(RESET)"
	docker compose up -d postgres redis qdrant minio
	@echo "Waiting for services to be ready..."
	@sleep 3
	@echo "$(GREEN)✅ Infrastructure ready$(RESET)"
	@echo "  PostgreSQL → localhost:5432"
	@echo "  Redis      → localhost:6379"
	@echo "  Qdrant     → localhost:6333  (UI: http://localhost:6334/dashboard)"
	@echo "  MinIO      → localhost:9000  (Console: http://localhost:9001)"

docker-all: ## Start ALL Docker services including app containers
	docker compose up -d
	@echo "$(GREEN)✅ All services running$(RESET)"
	@echo "  App        → http://localhost:3000"
	@echo "  API        → http://localhost:3001"
	@echo "  AI Service → http://localhost:8000"

docker-down: ## Stop all Docker services
	docker compose down

docker-reset: ## Destroy all containers AND volumes (fresh start)
	@echo "⚠️  This will delete all data. Press Ctrl+C to cancel..."
	@sleep 3
	docker compose down -v --remove-orphans
	@echo "$(GREEN)✅ Reset complete$(RESET)"

docker-logs: ## Follow logs from all running containers
	docker compose logs -f --tail=100

docker-logs-%: ## Follow logs from a specific service (e.g. make docker-logs-postgres)
	docker compose logs -f --tail=100 $*

# ── Database ──────────────────────────────────────────────────────
db-migrate: ## Run Prisma migrations
	cd apps/api-gateway && npx prisma migrate dev

db-push: ## Push schema changes without migration file (dev only)
	cd apps/api-gateway && npx prisma db push

db-seed: ## Seed database with demo data
	cd apps/api-gateway && npm run db:seed

db-studio: ## Open Prisma Studio in browser
	cd apps/api-gateway && npx prisma studio &
	@sleep 2 && $(OPEN) http://localhost:5555

db-reset: ## Reset database, re-run migrations, and seed
	cd apps/api-gateway && npx prisma migrate reset --force
	$(MAKE) db-seed

db-generate: ## Regenerate Prisma client after schema changes
	cd apps/api-gateway && npx prisma generate

# ── Quality ───────────────────────────────────────────────────────
test: ## Run all tests (Node + Python)
	@echo "$(GREEN)Running API Gateway tests...$(RESET)"
	npm test --workspace=apps/api-gateway
	@echo "$(GREEN)Running Python AI service tests...$(RESET)"
	cd services/ai-service && .venv/bin/pytest tests/ -v

test-node: ## Run only Node.js tests
	npm test --workspace=apps/api-gateway

test-python: ## Run only Python tests
	cd services/ai-service && .venv/bin/pytest tests/ -v --tb=short

test-watch: ## Run Node.js tests in watch mode
	npm run test:watch --workspace=apps/api-gateway

lint: ## Lint all workspaces
	npm run lint

type-check: ## Run TypeScript type checking
	npm run type-check

build: ## Build all packages for production
	npm run build

# ── Utilities ─────────────────────────────────────────────────────
open: ## Open the dashboard in your browser
	$(OPEN) http://localhost:3000

open-minio: ## Open MinIO console
	$(OPEN) http://localhost:9001

open-qdrant: ## Open Qdrant dashboard
	$(OPEN) http://localhost:6334/dashboard

open-widget-demo: ## Open the widget demo page
	$(OPEN) http://localhost:3000/widget-demo.html

clean: ## Remove build artifacts and caches
	rm -rf apps/api-gateway/dist
	rm -rf apps/web/.next
	rm -rf .turbo
	find . -name "*.tsbuildinfo" -delete
	@echo "$(GREEN)✅ Cleaned$(RESET)"

setup: env install docker-up db-migrate db-seed ## Full first-time setup
	@echo ""
	@echo "$(BOLD)$(GREEN)🎉 SupportIQ AI is ready!$(RESET)"
	@echo ""
	@echo "  Run $(CYAN)make dev$(RESET) to start all services"
	@echo "  Open $(CYAN)http://localhost:3000$(RESET)"
	@echo "  Login: $(CYAN)demo@acme.com$(RESET) / $(CYAN)demo1234!$(RESET)"
	@echo ""
