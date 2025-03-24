# ポケット勤怠システム セットアップ手順

## 環境構築

### 1. リポジトリのクローンと初期設定
```bash
git clone https://github.com/SugiKent/attendance-system.git
cd attendance-system
git pull origin main
```

### 2. 依存関係のインストール
```bash
sh .openhands/setup.sh  # PostgreSQLなどシステム依存関係のインストール
make build              # フロントエンド/バックエンドの依存関係インストール
```

### 3. データベース設定
```bash
# PostgreSQL認証設定変更
sudo sed -i 's/peer/md5/g' /etc/postgresql/15/main/pg_hba.conf
sudo service postgresql restart

# データベース作成とマイグレーション
cd backend
npx prisma migrate dev --name init
npx prisma db seed
```

## 開発サーバー起動

### バックエンド (ポート5000)
```bash
make run-backend
```

### フロントエンド (ポート5173)
```bash
make run-frontend
```

## 初期アクセス
- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:5000

## 管理者アカウント
シードデータにより以下のアカウントが自動生成されます：
- メール: admin@example.com
- パスワード: password