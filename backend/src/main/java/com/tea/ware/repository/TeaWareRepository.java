package com.tea.ware.repository;

import com.tea.ware.entity.TeaWare;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 茶器仓储（T8 最小：ware_id 存在性校验；完整目录切片后续展开）。
 */
public interface TeaWareRepository extends JpaRepository<TeaWare, Integer> {
}
