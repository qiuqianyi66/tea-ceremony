package com.tea.tea.service;

import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.NotFoundException;
import com.tea.common.response.PageResult;
import com.tea.tea.entity.Tea;
import com.tea.tea.repository.TeaRepository;
import com.tea.tea.vo.TeaVo;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 茶叶目录（F7-1 列表 / F7-2 详情；PRD F2/F3 游客可浏览）。
 * 分页契约：page 1-based、size 1-100（编码规范），默认按 id 排序（seeds 顺序即茶类分组）。
 */
@Service
@RequiredArgsConstructor
public class TeaService {

    private static final int MAX_SIZE = 100;

    private final TeaRepository teaRepository;

    @Transactional(readOnly = true)
    public PageResult<TeaVo> list(String category, String origin, int page, int size) {
        if (page < 1) {
            throw new BadRequestException("page 必须 ≥ 1");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new BadRequestException("size 必须在 1-100 之间");
        }
        Specification<Tea> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (category != null && !category.isBlank()) {
                predicates.add(cb.equal(root.get("category"), category.trim()));
            }
            if (origin != null && !origin.isBlank()) {
                predicates.add(cb.like(root.get("origin"), "%" + origin.trim() + "%"));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<Tea> result = teaRepository.findAll(spec, PageRequest.of(page - 1, size, Sort.by("id")));
        List<TeaVo> items = result.getContent().stream().map(TeaVo::from).toList();
        return PageResult.of(items, result.getTotalElements(), page, size);
    }

    @Transactional(readOnly = true)
    public TeaVo getById(Integer id) {
        Tea tea = teaRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("茶叶不存在"));
        return TeaVo.from(tea);
    }
}
