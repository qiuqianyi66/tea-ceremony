# 参与贡献

感谢你对「一盏茶」的兴趣。欢迎提交 Bug、改进建议和代码贡献。

## 开发环境

- Node.js 22+
- npm
- Python 3.12+（仅修改后端时需要）
- Docker Desktop（运行完整服务时需要）

```bash
npm install
npm run dev
```

## 提交前检查

```bash
npm run type-check
npm run build
npm run smoke
```

如果修改了后端，请至少执行：

```bash
python -m compileall -q backend
```

## Pull Request 建议

1. 一个 PR 尽量只解决一个主题。
2. UI 变更请附上截图或录屏，并说明测试设备尺寸。
3. 说明数据迁移、环境变量或部署配置是否发生变化。
4. 不要提交 `.env`、数据库密码、Token 或其他密钥。
5. PR 描述中写明已执行的检查命令。

## Commit 建议

推荐使用清晰的动词开头，例如：

```text
feat: 增加茶器解锁流程
fix: 修复离线记录同步重复写入
docs: 更新部署说明
refactor: 拆分品鉴评分服务
```
