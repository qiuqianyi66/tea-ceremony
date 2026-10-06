---
name: transaction-consistency
description: 事务一致性——@Transactional(rollbackFor) 边界 = 业务用例，只读 readOnly，幂等 + 乐观锁。业务专项 05（品鉴提交/画像更新）。
---

# Transaction Consistency

## 触发
- 多写操作（品鉴提交、用户画像更新）；一致性敏感场景。

## 工作流
1. 写方法 `@Transactional(rollbackFor = Exception.class)`；只读 `readOnly = true`。
2. 事务边界 = 业务用例边界（禁跨用例大事务、禁事务内 sleep/循环重试）。
3. 幂等：client_id 唯一键 + 唯一索引 + 冲突返回已有记录。
4. 并发：@Version 乐观锁（禁悲观锁滥用）。

## 红线
- 禁事务内远程调用/异步（#4）；写接口必须幂等（#5）。

## 自检
- [ ] 事务边界 = 用例边界
- [ ] 幂等键 + 唯一索引就位
- [ ] 乐观锁用于并发更新
- [ ] 无事务内远程调用
