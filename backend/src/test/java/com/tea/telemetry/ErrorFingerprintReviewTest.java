package com.tea.telemetry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.ConflictException;
import com.tea.common.exception.NotFoundException;
import com.tea.common.response.PageResult;
import com.tea.telemetry.dto.ErrorFingerprintView;
import com.tea.telemetry.dto.ReviewRequest;
import com.tea.telemetry.dto.ReviewStatus;
import com.tea.telemetry.entity.ErrorFingerprint;
import com.tea.telemetry.repository.ErrorFingerprintRepository;
import com.tea.telemetry.service.ErrorFingerprintService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

/**
 * Human-in-the-Loop 审批状态机（契约 §1）：
 * 只允许 pending → acknowledged/ignored、acknowledged → resolved。
 * 非法流转必须 409，不能静默改写状态——审批记录是「谁在什么状态上做了什么」的证据。
 */
@ExtendWith(MockitoExtension.class)
class ErrorFingerprintReviewTest {

    @Mock
    private ErrorFingerprintRepository repository;

    private ErrorFingerprintService service;

    @BeforeEach
    void setUp() {
        service = new ErrorFingerprintService(repository);
    }

    private ErrorFingerprint fingerprint(String status) {
        ErrorFingerprint entity = new ErrorFingerprint();
        entity.setId(1L);
        entity.setFingerprint("1a2b3c4d5e6f7a8b");
        entity.setSampleMessage("TypeError: boom");
        entity.setFirstSeenAt(LocalDateTime.now().minusHours(1));
        entity.setLastSeenAt(LocalDateTime.now());
        entity.setOccurrences(3);
        entity.setAffectedSessions(1);
        entity.setReviewStatus(status);
        return entity;
    }

    private ErrorFingerprintView review(String currentStatus, ReviewStatus target) {
        when(repository.findById(1L)).thenReturn(Optional.of(fingerprint(currentStatus)));
        when(repository.save(any(ErrorFingerprint.class))).thenAnswer(invocation -> invocation.getArgument(0));
        return service.review(1L, new ReviewRequest(target, "排查结论"), "yanha");
    }

    // ---- 合法流转 ----

    @Test
    void pendingCanBeAcknowledged() {
        ErrorFingerprintView view = review("pending", ReviewStatus.ACKNOWLEDGED);

        assertThat(view.reviewStatus()).isEqualTo("acknowledged");
        assertThat(view.reviewedBy()).isEqualTo("yanha");
        assertThat(view.reviewedAt()).isNotNull();
        assertThat(view.reviewNote()).isEqualTo("排查结论");
    }

    @Test
    void pendingCanBeIgnored() {
        assertThat(review("pending", ReviewStatus.IGNORED).reviewStatus()).isEqualTo("ignored");
    }

    @Test
    void acknowledgedCanBeResolved() {
        assertThat(review("acknowledged", ReviewStatus.RESOLVED).reviewStatus()).isEqualTo("resolved");
    }

    // ---- 非法流转 ----

    @Test
    void pendingCannotJumpToResolved() {
        when(repository.findById(1L)).thenReturn(Optional.of(fingerprint("pending")));

        assertThatThrownBy(() -> service.review(1L, new ReviewRequest(ReviewStatus.RESOLVED, null), "yanha"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("pending")
                .hasMessageContaining("resolved");
    }

    @Test
    void acknowledgedCannotRollBackToPending() {
        when(repository.findById(1L)).thenReturn(Optional.of(fingerprint("acknowledged")));

        assertThatThrownBy(() -> service.review(1L, new ReviewRequest(ReviewStatus.PENDING, null), "yanha"))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void resolvedIsTerminal() {
        when(repository.findById(1L)).thenReturn(Optional.of(fingerprint("resolved")));

        assertThatThrownBy(() -> service.review(1L, new ReviewRequest(ReviewStatus.ACKNOWLEDGED, null), "yanha"))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void ignoredIsTerminal() {
        when(repository.findById(1L)).thenReturn(Optional.of(fingerprint("ignored")));

        assertThatThrownBy(() -> service.review(1L, new ReviewRequest(ReviewStatus.RESOLVED, null), "yanha"))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void selfTransitionIsRejected() {
        when(repository.findById(1L)).thenReturn(Optional.of(fingerprint("pending")));

        assertThatThrownBy(() -> service.review(1L, new ReviewRequest(ReviewStatus.PENDING, null), "yanha"))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void unknownFingerprintReturnsNotFound() {
        when(repository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.review(9L, new ReviewRequest(ReviewStatus.ACKNOWLEDGED, null), "yanha"))
                .isInstanceOf(NotFoundException.class);
    }

    // ---- 列表与过滤 ----

    @Test
    void listFiltersByReviewStatus() {
        Page<ErrorFingerprint> page = new PageImpl<>(List.of(fingerprint("pending")),
                PageRequest.of(0, 20), 1);
        when(repository.findByReviewStatus(any(), any(Pageable.class))).thenReturn(page);

        PageResult<ErrorFingerprintView> result = service.list("pending", 1, 20);

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).reviewStatus()).isEqualTo("pending");
        assertThat(result.page()).isEqualTo(1);
        assertThat(result.size()).isEqualTo(20);
    }

    @Test
    void listWithoutFilterFallsBackToAll() {
        Page<ErrorFingerprint> page = new PageImpl<>(List.of(fingerprint("pending")), PageRequest.of(0, 20), 1);
        when(repository.findAll(any(Pageable.class))).thenReturn(page);

        assertThat(service.list(null, 1, 20).items()).hasSize(1);
    }

    @Test
    void listRejectsUnknownReviewStatus() {
        assertThatThrownBy(() -> service.list("done", 1, 20)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void listClampsPageSizeToOneHundred() {
        Page<ErrorFingerprint> page = new PageImpl<>(List.of(), PageRequest.of(0, 100), 0);
        when(repository.findAll(any(Pageable.class))).thenReturn(page);

        assertThat(service.list(null, 0, 5000).size()).isEqualTo(100);
    }
}
