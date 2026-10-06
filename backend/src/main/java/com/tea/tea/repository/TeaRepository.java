package com.tea.tea.repository;

import com.tea.tea.entity.Tea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * 茶叶仓储（JpaSpecificationExecutor 支持筛选动态查询）。
 */
public interface TeaRepository extends JpaRepository<Tea, Integer>, JpaSpecificationExecutor<Tea> {
}
