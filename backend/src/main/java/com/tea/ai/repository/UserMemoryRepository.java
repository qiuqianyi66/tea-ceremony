package com.tea.ai.repository;

import com.tea.ai.entity.UserMemory;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 跨会话用户画像 Repository。upsert 走 findByUserIdAndKey（每用户每类一行，uk_user_memory_user_key 兜底）。
 */
public interface UserMemoryRepository extends JpaRepository<UserMemory, Integer> {

    Optional<UserMemory> findByUserIdAndKey(Integer userId, String key);

    List<UserMemory> findByUserIdOrderByUpdatedAtDesc(Integer userId);

    long deleteByUserIdAndKey(Integer userId, String key);
}
