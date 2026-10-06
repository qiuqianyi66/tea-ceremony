---
name: deploy-verify
description: 部署验证——十阶段 8-10：预发验证→上线部署→30 分钟观测，冒烟任何场景不可省略。流水线阶段 8-10。
---

# Deploy Verify

## 触发
- 阶段 8-10：staging 验证、生产部署、上线观测。

## 工作流
1. **预发验证（阶段 8）**：docker-compose 起 staging → 健康检查（/health liveness + /health/readiness readiness，Actuator base-path=/）→ 冒烟（关键链路：登录/品鉴提交/AI 对话）。
2. **上线部署（阶段 9）**：部署脚本执行 → 冒烟再跑一遍 → 版本标签（git sha）记录。
3. **线上观测（阶段 10）**：30 分钟观测——错误率 / 延迟 P50-P99 / 资源 / AI token 成本在基线内。
4. **回滚**：冒烟失败 → 回滚镜像/版本；迁移异常 → 执行 rollback.sql；观测越基线 → 回预发（回滚路线表）。

## 红线
- 冒烟任何场景不可省略；Quality Gate 不过不进下一阶段（部署门禁 #15）。

## 自检
- [ ] staging 冒烟通过
- [ ] 生产部署成功 + 冒烟通过
- [ ] 30 分钟观测无异常
- [ ] 回滚路线明确（镜像标签可回退）