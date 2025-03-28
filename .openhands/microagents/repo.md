---
name: repo
type: repo
version: 0.2.0
agent: CodeActAgent
---

Repository: attendance-system
Description: ポケット勤怠

# 前提

- tmux を用いて作業をする
- 作業中 make run で起動したプロセスは tmux の window で起動し続ける
- 追加でターミナルで行いたい作業は tmux で新たな window を作って行う
- systemctl は使えないです

# 手順

## 1. 依存関係のインストール
```bash
tmux new-session -d -s setup "cd /workspace/attendance-system && sh .openhands/setup.sh"
```

## 2. 開発サーバー起動

```bash
tmux new-session -d -s backend "cd /workspace/attendance-system/backend && npm run dev"
tmux new-session -d -s frontend "cd /workspace/attendance-system/frontend && npm run dev"
```

## 3. 初期アクセス
- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:5000

# テストアカウント
## 管理者アカウント
シードデータにより以下のアカウントが自動生成されます：
- メール: admin@example.com
- パスワード: password