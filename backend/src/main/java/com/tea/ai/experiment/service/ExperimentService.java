package com.tea.ai.experiment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.experiment.dto.ExperimentOverview;
import com.tea.ai.experiment.dto.ExperimentReport;
import com.tea.ai.experiment.dto.ExperimentView;
import com.tea.ai.experiment.dto.GuardrailConfig;
import com.tea.ai.experiment.dto.VariantMetrics;
import com.tea.ai.experiment.entity.AbExperiment;
import com.tea.ai.experiment.repository.AbExperimentRepository;
import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.ConflictException;
import com.tea.common.exception.NotFoundException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A/B 实验：流量分桶 + 生命周期 + 双轨指标对比。
 *
 * 分桶为什么无状态：assignment 表要按「用户×实验」写一行，灰度一开就是写放大，且换实验要回填。
 * 这里用 SHA-256(expKey + ":" + subjectId) 取前 8 字节 → floorMod 100 → 落在 [0,100) 的桶，
 * 桶号 < trafficPercent 进 treatment。同 (expKey, subjectId) 永远同结果，跨重启/跨实例一致，
 * 客户端重试也不会在两组之间漂移。
 *
 * 安全的默认值：实验不存在 / 未 running / 占比 <= 0 / subjectId 缺失，一律返回 control（走旧路径）。
 * 灰度开关坏掉时最坏结果是「没灰度」，不是「所有人跑到半成品策略上」。
 *
 * 缓存：assign 在每次 AI 请求上调用，不能每请求查库。按 expKey 缓存 30 秒
 * （状态 + 占比即可决定分桶，不需要缓存整行）；启停时 {@link #evictCache(String)} 立即失效，
 * 保证运维点「停止」后最多一次读旧值的窗口，而不是 30 秒。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExperimentService {

    public static final String CONTROL = "control";
    public static final String TREATMENT = "treatment";
    /** 分桶总数：100 桶 = 百分比粒度，与 traffic_percent 的 0-100 语义一一对应。 */
    static final int BUCKETS = 100;
    /** 缓存有效期 30 秒：够挡住每请求查库，又短到实验改动能在一个观测窗口内生效。 */
    static final long CACHE_TTL_MS = 30_000L;
    /** 评估窗口 60 分钟：与 GoldenMetricsService 默认窗口一致，两个报表口径可直接对照。 */
    static final int EVALUATION_WINDOW_MINUTES = 60;
    /** P99 最小样本门槛（与 GoldenMetricsService.MIN_PERCENTILE_SAMPLES 同值同理由：少样本 99 分位等于最大值）。 */
    static final int MIN_P99_SAMPLES = 20;
    /** stop_reason 列宽 256，超长截断而不是让一次回滚写库失败。 */
    private static final int STOP_REASON_MAX = 256;
    /** 人工停止但未填原因时的兜底值：看板能区分「人工止血」与「自动回滚」。 */
    public static final String MANUAL_STOP_REASON = "manual_stop";
    /** trace 未标注 experiment 时的分组键（写入侧只记 variant 的情况，见 #variantsOf）。 */
    static final String UNATTRIBUTED_KEY = "";

    private final AbExperimentRepository repository;
    private final ObjectMapper objectMapper;

    /** expKey → 分桶所需的最小快照；缺失的实验也缓存（防不存在的 key 打穿数据库）。 */
    private final ConcurrentHashMap<String, CachedExperiment> cache = new ConcurrentHashMap<>();

    private record CachedExperiment(boolean found, String status, int trafficPercent, long loadedAtMs) {
    }

    // ---------------------------------------------------------------- 分桶

    /**
     * 判定某主体走哪条轨道。返回值只有 {@link #CONTROL} 或 {@link #TREATMENT}。
     * 任何无法判断的情况都回落 control（安全默认），不抛异常：灰度判定不该把业务请求打成 5xx。
     */
    public String assign(String expKey, String subjectId) {
        return assignActive(expKey, subjectId).orElse(CONTROL);
    }

    /**
     * 与 {@link #assign} 相同的分桶，但**区分「实验未运行」与「实验里分到对照」**。
     *
     * <p>为什么要这个区分：调用方常见的语义是「有实验就按实验走，没实验保持现状」。
     * 若只用 {@link #assign}，「没配置实验」与「配置了但你在对照组」都返回 control，
     * 调用方会把「未配置」误当成「明确要求走旧路径」——于是上线一个尚未启用的实验
     * 反而把已有能力关掉了。business 语义必须能区分这两件事。</p>
     *
     * @return 实验存在且 running、占比大于 0 时给出 control/treatment；否则 empty（调用方保持现状）
     */
    public Optional<String> assignActive(String expKey, String subjectId) {
        if (expKey == null || expKey.isBlank() || subjectId == null || subjectId.isBlank()) {
            return Optional.empty();
        }
        CachedExperiment experiment = cached(expKey);
        if (!experiment.found()
                || !AbExperiment.STATUS_RUNNING.equals(experiment.status())
                || experiment.trafficPercent() <= 0) {
            return Optional.empty();
        }
        return Optional.of(bucketOf(expKey, subjectId) < experiment.trafficPercent() ? TREATMENT : CONTROL);
    }

    /** 启停后立即失效缓存，避免「点了停止但还有 30 秒继续分流」的窗口。 */
    public void evictCache(String expKey) {
        if (expKey != null) {
            cache.remove(expKey);
        }
    }

    /**
     * 确定性分桶：SHA-256(expKey:subjectId) 前 8 字节拼 long，再 floorMod 100。
     * 不用 String.hashCode()：低位聚集，10 个实验里同一用户的桶号会高度相关，分布不均会让 10% 灰度实际跑到 15%。
     * floorMod 而非 %：long 可为负，% 会给出负桶号。
     */
    static int bucketOf(String expKey, String subjectId) {
        byte[] digest = sha256(expKey + ":" + subjectId);
        long value = 0L;
        for (int i = 0; i < 8; i++) {
            value = (value << 8) | (digest[i] & 0xFFL);
        }
        return (int) Math.floorMod(value, BUCKETS);
    }

    private static byte[] sha256(String input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 是 JVM 规范强制提供的算法；拿不到说明运行环境已损坏。
            // 不静默降级到 hashCode（那会悄悄改变分桶结果，把用户洗到另一组），直接失败更安全。
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    private CachedExperiment cached(String expKey) {
        long now = System.currentTimeMillis();
        CachedExperiment cached = cache.get(expKey);
        if (cached != null && now - cached.loadedAtMs() < CACHE_TTL_MS) {
            return cached;
        }
        // 并发下两个线程可能同时回源：最坏多查一次库，结果相同，不加锁换吞吐
        CachedExperiment fresh = load(expKey, now);
        cache.put(expKey, fresh);
        return fresh;
    }

    private CachedExperiment load(String expKey, long now) {
        return repository.findByExpKey(expKey)
                .map(experiment -> new CachedExperiment(true, experiment.getStatus(),
                        experiment.trafficPercentValue(), now))
                .orElseGet(() -> new CachedExperiment(false, null, 0, now));
    }

    // ---------------------------------------------------------------- 生命周期

    /** draft / paused → running；running 幂等返回；stopped 不可复活（要再灰度请新建实验）。 */
    @Transactional(rollbackFor = Exception.class)
    public ExperimentView start(String expKey) {
        AbExperiment experiment = requireExperiment(expKey);
        String status = experiment.getStatus();
        if (AbExperiment.STATUS_STOPPED.equals(status)) {
            throw new ConflictException("实验已停止，不能重新启动（新建 exp_key 再灰度）：" + expKey);
        }
        if (AbExperiment.STATUS_RUNNING.equals(status)) {
            // 幂等：运维脚本/重试重复调用 start 不该报错
            return view(experiment);
        }
        experiment.setStatus(AbExperiment.STATUS_RUNNING);
        // started_at 每轮启动覆盖：它表达「本轮灰度何时开始」，跨轮累计时间应由评估窗口看
        experiment.setStartedAt(LocalDateTime.now());
        experiment.setStoppedAt(null);
        experiment.setStopReason(null);
        repository.save(experiment);
        evictCache(expKey);
        log.info("A/B 实验启动：{}（traffic={}%）", expKey, experiment.trafficPercentValue());
        return view(experiment);
    }

    /** running → paused；paused 幂等返回；draft / stopped 不可暂停。 */
    @Transactional(rollbackFor = Exception.class)
    public ExperimentView pause(String expKey) {
        AbExperiment experiment = requireExperiment(expKey);
        String status = experiment.getStatus();
        if (AbExperiment.STATUS_PAUSED.equals(status)) {
            return view(experiment);
        }
        if (!AbExperiment.STATUS_RUNNING.equals(status)) {
            throw new ConflictException("只有 running 的实验可以暂停，当前：" + status);
        }
        experiment.setStatus(AbExperiment.STATUS_PAUSED);
        repository.save(experiment);
        evictCache(expKey);
        log.info("A/B 实验暂停：{}", expKey);
        return view(experiment);
    }

    /** 任意状态 → stopped；已 stopped 幂等返回（自动回滚与人工停止可能撞在同一秒）。 */
    @Transactional(rollbackFor = Exception.class)
    public ExperimentView stop(String expKey, String reason) {
        AbExperiment experiment = requireExperiment(expKey);
        if (AbExperiment.STATUS_STOPPED.equals(experiment.getStatus())) {
            return view(experiment);
        }
        experiment.setStatus(AbExperiment.STATUS_STOPPED);
        experiment.setStoppedAt(LocalDateTime.now());
        experiment.setStopReason(normalizeReason(reason));
        repository.save(experiment);
        evictCache(expKey);
        log.info("A/B 实验停止：{}（原因：{}）", expKey, experiment.getStopReason());
        return view(experiment);
    }

    private static String normalizeReason(String reason) {
        String trimmed = reason == null || reason.isBlank() ? MANUAL_STOP_REASON : reason.trim();
        return trimmed.length() > STOP_REASON_MAX ? trimmed.substring(0, STOP_REASON_MAX) : trimmed;
    }

    // ---------------------------------------------------------------- 观测

    /** GET /api/v1/ai/experiments：窗口 + 每个实验的 control/treatment 对比。 */
    @Transactional(readOnly = true)
    public ExperimentOverview overview() {
        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = end.minusMinutes(EVALUATION_WINDOW_MINUTES);
        Map<String, Map<String, VariantMetrics>> stats = variantStats(start, end);
        List<AbExperiment> all = repository.findAllByOrderByExpKeyAsc();
        List<String> runningKeys = all.stream()
                .filter(experiment -> AbExperiment.STATUS_RUNNING.equals(experiment.getStatus()))
                .map(AbExperiment::getExpKey)
                .toList();
        String singleRunningKey = runningKeys.size() == 1 ? runningKeys.get(0) : null;
        List<ExperimentReport> reports = new ArrayList<>();
        for (AbExperiment experiment : all) {
            reports.add(reportOf(experiment,
                    variantsOf(experiment.getExpKey(), stats, singleRunningKey, runningKeys.size())));
        }
        return new ExperimentOverview(start, end, reports);
    }

    /** GET /api/v1/ai/experiments/{key}：单实验详情（同一窗口与同一 SQL，数字与列表页一致）。 */
    @Transactional(readOnly = true)
    public ExperimentReport report(String expKey) {
        AbExperiment experiment = requireExperiment(expKey);
        LocalDateTime end = LocalDateTime.now();
        Map<String, Map<String, VariantMetrics>> stats =
                variantStats(end.minusMinutes(EVALUATION_WINDOW_MINUTES), end);
        List<String> runningKeys = repository.findByStatus(AbExperiment.STATUS_RUNNING).stream()
                .map(AbExperiment::getExpKey)
                .toList();
        String singleRunningKey = runningKeys.size() == 1 ? runningKeys.get(0) : null;
        return reportOf(experiment, variantsOf(expKey, stats, singleRunningKey, runningKeys.size()));
    }

    /**
     * 取某实验的变体指标。
     *
     * 归属规则：优先用 plan_layer 里标注了 experiment 的行；若该实验没有自己的行，而窗口内存在
     * 「未标注 experiment」的行（当前 TraceRecorder 只写 variant），则仅在它是唯一 running 实验时计入。
     * 多个实验并行时未标注的行无法区分归属——忽略并告警，避免把流量算给错误的实验。
     */
    public static Map<String, VariantMetrics> variantsOf(String expKey, Map<String, Map<String, VariantMetrics>> stats,
                                                        String singleRunningKey, int runningCount) {
        Map<String, VariantMetrics> own = stats.get(expKey);
        if (own != null && !own.isEmpty()) {
            return own;
        }
        Map<String, VariantMetrics> unattributed = stats.getOrDefault(UNATTRIBUTED_KEY, Map.of());
        if (!unattributed.isEmpty()) {
            if (expKey.equals(singleRunningKey)) {
                return unattributed;
            }
            if (runningCount > 1) {
                log.warn("窗口内存在未标注 experiment 的 A/B trace（{} 个变体组），同时有 {} 个 running 实验：无法归属，已忽略",
                        unattributed.size(), runningCount);
            }
        }
        return own == null ? Map.of() : own;
    }

    /** 最近 60 分钟的变体指标，按 exp_key → variant 组织；守卫任务与概览共用（同一 SQL、同一窗口）。 */
    @Transactional(readOnly = true)
    public Map<String, Map<String, VariantMetrics>> variantStats() {
        LocalDateTime end = LocalDateTime.now();
        return variantStats(end.minusMinutes(EVALUATION_WINDOW_MINUTES), end);
    }

    /** 守卫任务写回评估结果：样本不足也要更新，否则「没评估」与「评估了但样本不够」看不出来。 */
    @Transactional(rollbackFor = Exception.class)
    public void recordEvaluation(String expKey, int sampleSize, LocalDateTime evaluatedAt) {
        repository.findByExpKey(expKey).ifPresent(experiment -> {
            experiment.setSampleSize(sampleSize);
            experiment.setLastEvaluatedAt(evaluatedAt);
            repository.save(experiment);
        });
    }

    /** guardrail JSONB → 强类型（缺键取默认值），守卫与报表共用同一解析。 */
    public GuardrailConfig guardrailOf(AbExperiment experiment) {
        return GuardrailConfig.fromJson(jsonOrNull(experiment.getGuardrail()));
    }

    private ExperimentReport reportOf(AbExperiment experiment, Map<String, VariantMetrics> variants) {
        Map<String, VariantMetrics> byVariant = variants == null ? Map.of() : variants;
        VariantMetrics control = byVariant.getOrDefault(CONTROL, VariantMetrics.empty(CONTROL));
        VariantMetrics treatment = byVariant.getOrDefault(TREATMENT, VariantMetrics.empty(TREATMENT));
        GuardrailConfig guardrail = guardrailOf(experiment);
        boolean sufficientSample = control.calls() >= guardrail.minSampleSize()
                && treatment.calls() >= guardrail.minSampleSize();
        return new ExperimentReport(view(experiment), guardrail, control, treatment, sufficientSample);
    }

    private Map<String, Map<String, VariantMetrics>> variantStats(LocalDateTime start, LocalDateTime end) {
        Map<String, Map<String, VariantMetrics>> result = new HashMap<>();
        for (Object[] row : repository.variantWindowStats(start, end)) {
            if (row == null || row.length < 5 || row[1] == null) {
                continue;
            }
            // exp_key 允许为空：未标注实验的行归入 UNATTRIBUTED_KEY，由 variantsOf 决定是否计入
            String expKey = row[0] == null ? UNATTRIBUTED_KEY : String.valueOf(row[0]);
            String variant = String.valueOf(row[1]);
            result.computeIfAbsent(expKey, key -> new HashMap<>())
                    .put(variant, metrics(variant, longOf(row[2]), longOf(row[3]), doubleOrNull(row[4])));
        }
        return result;
    }

    private static VariantMetrics metrics(String variant, long calls, long errorCalls, Double p99) {
        // 零样本给 null 不给 0：0 会被读成「这条路径全好」，与 GoldenMetricsService 同一取舍
        Double errorRate = calls <= 0 ? null : round(errorCalls / (double) calls, 3);
        Double p99Value = p99 == null || calls < MIN_P99_SAMPLES ? null : round(p99, 1);
        return new VariantMetrics(variant, calls, errorRate, p99Value);
    }

    // ---------------------------------------------------------------- 内部工具

    private AbExperiment requireExperiment(String expKey) {
        if (expKey == null || expKey.isBlank()) {
            throw new BadRequestException("实验标识不能为空");
        }
        return repository.findByExpKey(expKey)
                .orElseThrow(() -> new NotFoundException("实验不存在：" + expKey));
    }

    private ExperimentView view(AbExperiment experiment) {
        return new ExperimentView(
                experiment.getExpKey(),
                experiment.getName(),
                experiment.getDescription(),
                experiment.getStatus(),
                experiment.trafficPercentValue(),
                jsonOrNull(experiment.getVariants()),
                experiment.getSampleSize() == null ? 0 : experiment.getSampleSize(),
                experiment.getLastEvaluatedAt(),
                experiment.getStartedAt(),
                experiment.getStoppedAt(),
                experiment.getStopReason(),
                experiment.getCreatedAt(),
                experiment.getUpdatedAt());
    }

    /** JSONB 原文 → JsonNode；脏数据不抛异常（一只坏实验不该让整个列表 500），按空处理并留日志。 */
    private JsonNode jsonOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(raw);
        } catch (JsonProcessingException e) {
            log.warn("实验 JSONB 解析失败，按空处理：{}", e.getOriginalMessage());
            return null;
        }
    }

    private static long longOf(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private static Double doubleOrNull(Object value) {
        return value instanceof Number number ? number.doubleValue() : null;
    }

    /** 与 GoldenMetricsService 同一舍入风格（四舍五入到 digits 位）。 */
    private static double round(double value, int digits) {
        double scale = Math.pow(10, digits);
        return Math.round(value * scale) / scale;
    }
}
