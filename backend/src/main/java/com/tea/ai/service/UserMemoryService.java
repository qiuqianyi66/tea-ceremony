package com.tea.ai.service;

import com.tea.ai.entity.UserMemory;
import com.tea.ai.repository.UserMemoryRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 跨会话用户画像读写（user_memory，V12）。每用户每类一行摘要，upsert 语义：同 key 合并更新，不追加行。
 *
 * <p>隐私红线（F-B2 / ADR-028）：</p>
 * <ul>
 *   <li>抽取侧 prompt 明令不记录姓名/账号等敏感信息（见 {@link UserMemoryExtractor}）；</li>
 *   <li>注入侧只放提炼后的摘要，不回灌原始对话；</li>
 *   <li>list/delete 一律带 userId 归属校验——用户只能看/删自己的画像。</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserMemoryService {

    /** key → 中文类别名（注入 prompt 用；与 ck_user_memory_key 约束一致）。 */
    private static final Map<String, String> KEY_LABELS = Map.of(
            UserMemory.KEY_PREFERENCE, "偏好",
            UserMemory.KEY_RESTRICTION, "忌口",
            UserMemory.KEY_HABIT, "习惯");

    private final UserMemoryRepository repository;

    /** upsert：同 (userId, key) 更新合并摘要；不存在则插入。抽取合并写回的唯一入口。 */
    @Transactional(rollbackFor = Exception.class)
    public void upsert(Integer userId, String key, String value, Integer sourceSessionId) {
        if (userId == null || key == null || value == null || value.isBlank()) {
            return;
        }
        UserMemory row = repository.findByUserIdAndKey(userId, key).orElseGet(() -> {
            UserMemory fresh = new UserMemory();
            fresh.setUserId(userId);
            fresh.setKey(key);
            return fresh;
        });
        row.setValue(value.trim());
        row.setSourceSessionId(sourceSessionId);
        repository.save(row);
    }

    /** 注入 system prompt 的聚合摘要：无画像返回空串（调用方判空不注入）。 */
    @Transactional(readOnly = true)
    public String summaryForPrompt(Integer userId) {
        if (userId == null) {
            return "";
        }
        List<UserMemory> rows = repository.findByUserIdOrderByUpdatedAtDesc(userId);
        if (rows.isEmpty()) {
            return "";
        }
        Map<String, String> ordered = new LinkedHashMap<>();
        for (UserMemory row : rows) {
            String label = KEY_LABELS.getOrDefault(row.getKey(), row.getKey());
            ordered.put(label, row.getValue());
        }
        StringBuilder sb = new StringBuilder("关于这位茶客，我们已知（回答时自然照应，不要逐条念出来）：");
        ordered.forEach((label, value) -> sb.append('\n').append("- ").append(label).append("：").append(value));
        return sb.toString();
    }

    /** 当前画像摘要（供注入 prompt 之外的查看场景；key → 合并后 value）。 */
    @Transactional(readOnly = true)
    public Map<String, String> existingSummaries(Integer userId) {
        Map<String, String> out = new LinkedHashMap<>();
        for (UserMemory row : repository.findByUserIdOrderByUpdatedAtDesc(userId)) {
            out.put(row.getKey(), row.getValue());
        }
        return out;
    }

    /** 隐私：查看自己的画像（归属由 userId 参数本身限定，无跨用户入口）。 */
    @Transactional(readOnly = true)
    public List<UserMemory> list(Integer userId) {
        return repository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    /** 隐私：删除自己某一类画像（记错修正路径）。返回删除行数（0 = 本就没有）。 */
    @Transactional(rollbackFor = Exception.class)
    public long delete(Integer userId, String key) {
        if (userId == null || key == null) {
            return 0;
        }
        return repository.deleteByUserIdAndKey(userId, key);
    }
}
