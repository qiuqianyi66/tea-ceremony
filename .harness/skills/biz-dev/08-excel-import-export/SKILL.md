---
name: excel-import-export
description: Excel 导入导出——文化数据批量导入（seeds）、导出模板，校验 + 错误行报告。业务专项 08（按需，首版文化 seeds 用）。
---

# Excel Import Export

## 触发
- 批量导入（文化数据 seeds）；导出（品鉴数据备份）。

## 工作流
1. 读模板 → 校验（表头/必填/枚举/范围）→ 分批入库（500 行/批）。
2. 错误行收集 → 返回错误报告（行号 + 原因），禁静默跳过。
3. 导出用流式（SXSSF/POI 或 EasyExcel），禁一次全量内存。
4. 导入幂等：client_id/唯一键去重。

## 自检
- [ ] 校验 + 错误行报告
- [ ] 分批导入（非全量内存）
- [ ] 幂等去重
- [ ] 模板与 data-model 一致
