---
name: crud-scaffold
description: CRUD 脚手架——标准五步（Entity→Repository→Service→Controller→DTO/VO）生成茶叶/茶器/文化等标准增删改查。业务专项 01。
---

# CRUD Scaffold

## 触发
- 新增标准 CRUD 资源（茶叶/茶器/文化/用户偏好等）；非标准逻辑走 coding-skill。

## 工作流
1. Entity（JPA 注解 + 软删 @SQLDelete/@SQLRestriction + 审计字段）。
2. Repository（JpaRepository + 分页 PageRequest）。
3. Service（@RequiredArgsConstructor + 事务边界 + 业务异常）。
4. Controller（只做参数与响应 + ApiResponse<T>）。
5. DTO/VO 分离（MapStruct 转换，禁 BeanUtils）。

## 红线
- 分层单向依赖（#1）；四层对象分离（#3）；迁移走 Flyway（#7）。
- Controller 禁业务逻辑；Entity 禁直接出参。

## 自检
- [ ] 五步齐全，无跨层
- [ ] DTO/VO 分离，MapStruct 转换
- [ ] 软删/审计/分页就位
- [ ] 测试覆盖 CRUD 正常+边界+异常
