---
name: business-validation
description: 业务校验——Bean Validation + 范围校验（八维 0-100/工艺系数 0.8-1.2），输出脱敏。业务专项 07。
---

# Business Validation

## 触发
- 入参校验、业务规则校验（评分/系数/枚举）、输出脱敏。

## 工作流
1. DTO 加 Bean Validation（@Valid + 分组校验）。
2. 业务范围：八维评分 0-100、工艺系数 0.8-1.2（越界视为数据异常）、枚举合法值（glossary 状态枚举）。
3. 输出脱敏：手机/邮箱/Token 在 VO 层处理。
4. 校验失败 → BadRequestException（VALIDATION_ERROR 422）。

## 自检
- [ ] 入参校验注解齐全
- [ ] 业务范围校验（评分/系数/枚举）
- [ ] 输出脱敏
- [ ] 校验失败统一错误响应
