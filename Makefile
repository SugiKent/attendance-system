.PHONY: build run build-backend build-frontend run-backend run-frontend

# メインコマンド
build: build-backend build-frontend

run: run-backend run-frontend

# バックエンドのセットアップ
build-backend:
	cd backend && npm install && npx prisma generate && npx prisma migrate deploy && npx prisma db seed

# フロントエンドのセットアップ
build-frontend:
	cd frontend && npm install && cp .env.example .env

# バックエンドの実行
run-backend:
	cd backend && npm run dev

# フロントエンドの実行
run-frontend:
	cd frontend && npm run dev
