package com.tea.telemetry.service;

import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.ConflictException;
import com.tea.common.exception.NotFoundException;
import com.tea.common.response.PageResult;
import com.tea.telemetry.dto.ErrorFingerprintView;
import com.tea.telemetry.dto.ReviewRequest;
import com.tea.telemetry.dto.ReviewStatus;
import com.tea.telemetry.entity.ErrorFingerprint;
import com.tea.telemetry.repository.ErrorFingerprintRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 错误指纹查询与人工审批（契约 §1）。
 * 审批是 Human-in-the-Loop 状态机：只允许 pending → acknowledged|ignored、acknowledged → resolved。
 * 非法流转抛 409 而不是静默修正——审批记录要能解释「谁在什么状态上做了什么」，静默改写会毁掉这条证据链。
 */
@Service
@RequiredArgsConstructor
public class ErrorFingerprintService {

    /** 分页上限对齐编码规范 §15（size ≤ 100）。 */
    private static final int MAX_PAGE_SIZE = 100;

    private final ErrorFingerprintRepository repository;

    @Transactional(readOnly = true)
    public PageResult<ErrorFingerprintView> list(String reviewStatus, int page, int size) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        // 按最近出现时间倒序：运维最关心「刚刚又炸了」的那批
        Pageable pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(Sort.Direction.DESC, "lastSeenAt"));
        Page<ErrorFingerprint> result;
        if (reviewStatus == null || reviewStatus.isBlank()) {
            result = repository.findAll(pageable);
        } else {
            ReviewStatus status = ReviewStatus.from(reviewStatus.trim());
            if (status == null) {
                throw new BadRequestException("reviewStatus 非法：" + reviewStatus);
            }
            result = repository.findByReviewStatus(status.value(), pageable);
        }
        return PageResult.of(result.getContent().stream().map(ErrorFingerprintView::from).toList(),
                result.getTotalElements(), safePage, safeSize);
    }

    /** 审批人取自 JWT 主体（不可由请求体伪造）；note 可空。 */
    @Transactional(rollbackFor = Exception.class)
    public ErrorFingerprintView review(Long id, ReviewRequest request, String reviewer) {
        ErrorFingerprint fingerprint = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("错误指纹不存在"));
        ReviewStatus current = ReviewStatus.from(fingerprint.getReviewStatus());
        if (current == null) {
            throw new ConflictException("错误指纹状态异常：" + fingerprint.getReviewStatus());
        }
        ReviewStatus target = request.status();
        if (!transitionAllowed(current, target)) {
            throw new ConflictException("非法状态流转：" + current.value() + " → " + target.value());
        }
        fingerprint.setReviewStatus(target.value());
        fingerprint.setReviewedBy(reviewer);
        fingerprint.setReviewedAt(LocalDateTime.now());
        fingerprint.setReviewNote(request.note());
        return ErrorFingerprintView.from(repository.save(fingerprint));
    }

    /** 状态机唯一实现点（纯函数，便于逐条断言）。ignored/resolved 是终态，不允许再流转。 */
    static boolean transitionAllowed(ReviewStatus from, ReviewStatus to) {
        return switch (from) {
            case PENDING -> to == ReviewStatus.ACKNOWLEDGED || to == ReviewStatus.IGNORED;
            case ACKNOWLEDGED -> to == ReviewStatus.RESOLVED;
            case IGNORED, RESOLVED -> false;
        };
    }
}
