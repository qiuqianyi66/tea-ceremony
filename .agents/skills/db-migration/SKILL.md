---
name: db-migration
description: 一盏茶项目的数据库迁移规范。当用户要求修改数据库表结构、新增字段、或执行数据迁移时触发。
---

# 数据库迁移规范

一盏茶项目使用 PostgreSQL + SQLAlchemy 2.0 + Alembic 做数据库迁移。任何数据库结构变更必须走迁移流程。

## 1. 绝对禁止

- 禁止直接在数据库中手动执行 DDL
- 禁止修改模型后不生成迁移脚本
- 禁止删除已应用的迁移文件
- 禁止在迁移脚本中写不可逆操作而不写 downgrade

## 2. 标准流程

### 步骤 1：修改模型

编辑 `backend/app/models/` 中的 ORM 模型。

### 步骤 2：生成迁移脚本

```bash
cd backend
alembic revision --autogenerate -m "简要描述变更，例如 add_user_avatar_field"
```

### 步骤 3：人工审核迁移脚本

**autogenerate 不完美，必须检查**：

- 检查是否正确识别了所有变更
- 检查是否有误删（autogenerate 有时会误判）
- 检查字段类型、默认值、约束是否正确
- 数据迁移必须手动补充（autogenerate 只处理 schema，不处理数据）

### 步骤 4：执行迁移

```bash
alembic upgrade head
```

### 步骤 5：验证

- 检查数据库表结构是否符合预期
- 如有数据迁移，验证数据正确性
- 启动后端，确认无报错

## 3. 数据迁移模板

当需要迁移数据（不只是改表结构）时，在迁移脚本中补充：

```python
from alembic import op
import sqlalchemy as sa

# 定义一个临时的表结构（只包含需要的字段），避免依赖模型
xxx_table = sa.table(
    "xxx",
    sa.column("id", sa.Integer),
    sa.column("old_field", sa.String),
    sa.column("new_field", sa.String),
)

def upgrade():
    # 1. schema 变更
    op.add_column("xxx", sa.Column("new_field", sa.String(100)))
    
    # 2. 数据迁移
    op.execute(
        xxx_table.update().values(new_field=xxx_table.c.old_field)
    )
    
    # 3. （可选）删除旧字段
    op.drop_column("xxx", "old_field")

def downgrade():
    # 反向操作
    op.add_column("xxx", sa.Column("old_field", sa.String(100)))
    op.execute(xxx_table.update().values(old_field=xxx_table.c.new_field))
    op.drop_column("xxx", "new_field")
```

## 4. 项目表结构参考

核心表（详见 `DATABASE_ER.md`）：

- `users` — 用户账户
- `teas` — 茶叶目录
- `tea_wares` — 茶器
- `tasting_records` — 品鉴记录（含 sync_status 离线同步字段）
- `culture_documents` — 茶文化资料（RAG 用）

## 5. 常见操作

### 加字段
```python
op.add_column("table_name", sa.Column("new_col", sa.String(100), nullable=True, server_default=""))
```

### 改字段类型
```python
op.alter_column("table_name", "col_name", type_=sa.Text())
```

### 加索引
```python
op.create_index("ix_table_col", "table_name", ["col_name"])
```

### 加外键
```python
op.create_foreign_key("fk_table_other", "table", "other", ["other_id"], ["id"])
```

## 6. 回滚

如果迁移出问题：
```bash
alembic downgrade -1    # 回滚上一个版本
alembic downgrade base  # 回滚所有
```

回滚前确认 downgrade 函数写对了。

## 7. 完成后检查清单

- [ ] 迁移脚本已生成并人工审核
- [ ] `alembic upgrade head` 执行成功
- [ ] 后端启动无数据库报错
- [ ] 涉及的数据已正确迁移
- [ ] `DATABASE_ER.md` 已同步更新（如果表结构变了）
