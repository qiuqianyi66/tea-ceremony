package com.tea.tea.repository;

import com.tea.tea.entity.Tea;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * 茶叶仓储（JpaSpecificationExecutor 支持筛选动态查询）。
 */
public interface TeaRepository extends JpaRepository<Tea, Integer>, JpaSpecificationExecutor<Tea> {

    /** 按名称模糊查询（多工具 brew_params 用：模型给的茶名可能不完整，模糊匹配比精确等值宽容）。 */
    List<Tea> findByNameContaining(String name);
}
