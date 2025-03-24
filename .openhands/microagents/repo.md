---
name: repo
type: repo
version: 0.0.1
agent: CodeActAgent
triggers:
- setup
- start
---

Repository: attendance-system
Description: ポケット勤怠のリポジトリ

### 前提

- tmux を用いて作業をする
- 作業中 make run で起動したプロセスは tmux の window で起動し続ける
- 追加でターミナルで行いたい作業は tmux で新たな window を作って行う

### 1. 依存関係のインストール
```bash
sh .openhands/setup.sh  # PostgreSQLなどシステム依存関係のインストール
make build              # フロントエンド/バックエンドの依存関係インストール
```

### 2. データベース設定
```bash
# PostgreSQL認証設定変更
sudo sed -i 's/peer/md5/g' /etc/postgresql/15/main/pg_hba.conf
sudo service postgresql restart

# データベース作成とマイグレーション
cd backend
npx prisma migrate dev --name init
npx prisma db seed
```

## 3. 開発サーバー起動

```bash
make run
```

## 4. 初期アクセス
- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:5000

## 管理者アカウント
シードデータにより以下のアカウントが自動生成されます：
- メール: admin@example.com
- パスワード: password