---
name: unit-test-ci
description: CI 门禁验证——跑前端 quality 门禁 + 后端测试 + 迁移往返，全绿才可进评审。流水线阶段 5-6。
type: executable
last-reviewed: 2026-10-29
verification: npm run quality
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

## 确定性入口

- 脚本单测：`node --test scripts/tests/*.node-test.cjs`
- 前端全量：`npm run test`
- 后端全量：`cd backend && mvn -q test`（须带 `clean`）

## 踩坑（真实教训）

- **`Skipped` 不等于通过**：它是「这段逻辑一次都没跑过」——本机跳过、CI 首跑必红（脱敏 UUID 与断言原文比对失败的用例就是这样暴露的）。
- **同类失败集中在基础设施层时先证环境**：13 个不相关测试类同时报 `Could not find a valid Docker environment`，是 Docker 引擎中途死亡，不是代码坏。`mvn` 报「0 run / 发现失败」先 `mvn clean` 复跑——`target/` 残留旧 class 会必现。
