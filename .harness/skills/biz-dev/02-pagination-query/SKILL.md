---
name: pagination-query
description: 分页查询——PageRequest + 条件分支 + 索引可用性，禁全表扫描、禁 N+1。业务专项 02（品鉴历史/茶叶目录）。
---

# Pagination Query

## 触发
- 列表/历史/目录查询；大数据量分页。

## 工作流
1. Repository 返回 `Page<T>`（PageRequest，size 上限 100）。
2. 条件分支用 Specification / @Query（命名参数防注入）。
3. 排序字段建索引（迁移脚本显式声明 `ix_{table}_{col}`）。
4. 关联查询防 N+1（@EntityGraph / fetch join）。

## 红线
- 禁全表扫描；禁循环内查询（#6 数据访问）；SQL 禁拼接（#9 安全）。

## 自检
- [ ] 分页契约统一（page/size，size ≤100）
- [ ] 索引可用性确认（EXPLAIN）
- [ ] 无 N+1
