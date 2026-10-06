---
name: unit-test-ci
description: CI 门禁验证——跑前端 quality 门禁 + 后端测试 + 迁移往返，全绿才可进评审。流水线阶段 5-6。
---

# Unit Test CI

## 触发
- 阶段 5 完成后验证；MR 合入前；CI 失败排查。

## 工作流
1. **前端门禁**：`npm run quality`（lint + type-check + test + build + verify）。
2. **后端测试**（过渡期）：`cd backend && python -m py_compile app/main.py` + `pytest tests -q`；重写后替换 `mvn -q test`。
3. **迁移测试**：upgrade/downgrade 往返（Testcontainers/本地 PG）。
4. **Compose 校验**：`docker compose config --quiet`。
5. **收尾**：全绿 → 记录证据 → 进阶段 6 评审；失败 → 按失败分类修复（编码规范红线优先）。

## 自检
- [ ] npm run quality 全绿
- [ ] 后端测试全绿（含迁移往返）
- [ ] compose 校验通过
- [ ] 证据已记录（跑了什么、结果如何）

## 下一步

进入 → `expert-reviewer`（专家评审）。
