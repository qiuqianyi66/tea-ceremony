# Review — T6 认证切片（auth 域，批 B 第一片）

> 评审人：MainAgent（expert-reviewer 流程，6 维评审）
> 日期：2026-10-05
> 变更范围：auth/（entity/repository/security/dto/vo/service/controller）、pom.xml（jjwt 0.12.6）、application.yml（tea.jwt）、AppConfig（Clock bean）、测试 15 个（JwtService 5 / AuthService 6 / Controller 4）
> 验证证据：`mvn -q test` ✓（23/23 全绿）、`mvn -q package` ✓
> 待补：@SpringBootTest 集成测试（真实 Postgres + Security 过滤链行为）——Docker 重启后

## 6 维评审

### 正确性
- JwtService：签发/解析/过期/篡改/密钥长度单测全覆盖；修复 jjwt 解析时钟不可控缺陷（Clock 注入 parser）。✅
- AuthService：register 存 BCrypt 哈希、重复用户名 Conflict、login 成功/密码错/用户不存在（统一文案）单测全覆盖。✅
- Controller：MVC 映射/校验 400/ApiResponse 序列化 @WebMvcTest 覆盖（addFilters=false）。✅

### 性能
- JwtAuthenticationFilter 无状态不查库，无每请求 DB 开销。✅

### 安全
- BCrypt + 无状态 JWT + secret ≥32 字节校验 + 环境变量注入（dev 默认值标注生产必须覆盖）。✅
- 登录失败统一文案（防枚举）、401 由 Security 统一处理。✅

### 一致性
- User 实体与 V1 users 表对齐；API 前缀 /api/v1/auth；错误码/响应复用 common。✅

### 可维护性
- auth 域四件套（entity/repository/service/controller）+ security/dto/vo 分目录；record 简洁；测试行为导向。✅

### 架构合规
- Controller→Service→Repository 单向；四层对象分离；红线 #2（无裸抛）；事务注解（写 @Transactional / 读 readOnly）。✅
- ⚠️ JwtService 构造校验抛 IllegalArgumentException——配置错误启动即失败，非业务路径，🟢 记录。

## 分级问题

- 🔴 阻断：无
- 🟡 主要：无
- 🟢 次要：
  - JwtService 构造抛 IllegalArgumentException（配置校验，可改为启动更早失败或自定义配置异常；记录不阻断）
  - AuthControllerTest 采用 addFilters=false（slice 与 Security 组合的已知做法）；Security 真实放行/401 行为待集成测试验证
- 🔵 提示：
  - JWT 无 jti/无账号禁用校验（无状态设计取舍；账号禁用需求出现时再引入）
  - username 在 DTO 校验长度后 Service 再 trim（trim 后可能短于 DTO 下限——影响极低，记录）

## 结论

T6 代码质量通过评审（🔴 零、🟡 零）。集成验证（Security 过滤链行为、JSONB 映射、真实库往返）待 Docker 重启后补，通过后随 feature/m1-auth 分支闭合。

---

## 2026-10-06 复核（集成测试 + 401 契约补全）

> 验证证据：`mvn -q test` ✓（31/31：单测 25 + 集成 6）、Testcontainers postgres:16 + Flyway V1 + RANDOM_PORT 真实 HTTP。

### 新增 AuthIntegrationTest（6 例，@SpringBootTest + Testcontainers + DynamicPropertySource）
- register → 200 + token，真实库持久化（含 JSONB preferredAroma 插入与读取往返）✓
- login 正确 → 200；密码错误 → 401 UNAUTHORIZED 统一文案 ✓
- 重复注册 → 409 CONFLICT（唯一索引 + 业务冲突路径）✓
- /actuator/health 放行 → 200 ✓
- 无 token / 无效 token 访问受保护路径 → **401 UNAUTHORIZED 统一 ApiResponse** ✓

### Security 401 契约修复（评审发现）
- 原实现：匿名访问受保护路径返回 **403 空 body**——与 JwtAuthenticationFilter 注释「受保护接口由 Security 返回 401」及编码规范 §6 统一响应不符
- 修复：SecurityConfig 补 `authenticationEntryPoint`，未认证/无效 token → 401 `ApiResponse(UNAUTHORIZED)`（注入 ObjectMapper 序列化）
- 影响面：仅 SecurityConfig；AuthControllerTest（addFilters=false）不受影响 ✓

### pom 变更
- 新增 `testcontainers.version=1.21.4`：Docker Engine v29（Desktop ≥4.52）将最低 API 版本提至 1.44，Boot 管理的 1.21.2/docker-java 3.4.2 协商旧版本被 npipe 400 拒绝（空 /info + com.docker.desktop.address）——1.21.4 官方修复此兼容性

### 分级问题（今日新增）
- 🔴 阻断：无
- 🟡 主要：无（401 契约已修复）
- 🟢 次要：无
- 🔵 提示：
  - JWT 无 jti/无账号禁用（既定取舍，需求出现再引入）
  - Docker TCP 暴露开关（settings ExposeDaemonOnTCP）已写入但本版未生效（4.94 未监昕 2375）；npipe 已可用，无需 TCP

## 结论（复核后）

T6 随批 A 闭合：🔴 零、🟡 清零、集成验证齐全。可提交。
