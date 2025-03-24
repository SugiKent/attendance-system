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

Setup:
- Run `sh .openhands/setup.sh` to install dependencies
- Use `make run` for development