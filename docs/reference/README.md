---
last_updated: 2026-10-07
status: active
owner: tea-harness
---

# docs/reference — 稳定参考层

> 285 Harness「docs/reference」（api-spec / error-codes）的 tea 对应物。放跨域稳定引用，改动低频、改动需同步。
> 目录约定见 `.harness/rules/工程结构.md` §六。

## 放什么

| 文件 | 内容 | 权威源 |
|---|---|---|
| `error-codes.md` | 全局错误码表（code/HTTP/文案/触发场景） | `backend/src/main/java/com/tea/common/errorcode/ErrorCode.java` |
| 未来 | springdoc OpenAPI spec（后端重写完成后接入时） | `backend` 运行时生成 |

## 规则

1. 每个文件带 frontmatter：`last_updated / status / owner`。
2. 引用类文档标注唯一权威源路径；改权威源后必须同步本层文档（doc-gardening 检查）。
3. 过期内容标 `status: deprecated`，不删除（留档）。
