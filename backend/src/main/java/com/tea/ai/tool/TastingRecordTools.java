package com.tea.ai.tool;

import com.tea.record.entity.TastingRecord;
import com.tea.record.repository.TastingRecordRepository;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

/**
 * 品鉴记录查询工具（多工具 Agent 单元）。
 *
 * <p>数据源：{@code tasting_records} 表（TastingRecordRepository，read-only 查询）。
 * 列表 + 均值一次返回（最近 N 条 + 平均综合分），覆盖「查列表 / 看详情 / 问均值」三类问法。</p>
 *
 * <p>安全设计（关键）：<b>userId 从不由模型传入</b>——模型看到的参数只有 limit。
 * 用户身份由 {@link #boundTo(Integer)} 在请求发起时绑定（与 CultureQueryTools 的 sink 绑定同模式），
 * 模型无法通过参数伪造或越权读他人记录。访客（userId=null）绑定的实例直接返回登录提示。</p>
 *
 * <p>异常纪律同 {@link CultureQueryTools}：工具失败降级为文案，绝不让整轮对话 500。</p>
 */
@Slf4j
@Component
public class TastingRecordTools {

    /** 工具名：模型侧契约。 */
    public static final String TOOL_NAME = "my_tasting_records";

    static final String TOOL_DESCRIPTION = """
            查询当前登录用户自己的品鉴记录（最近若干条，含茶名/水温/出汤/综合分/日期），并给出平均综合分。
            什么时候该调用：用户问「我以前喝过什么茶」「我上次泡的铁观音打几分」「我的品鉴平均分」之类与本人历史记录相关的问题时调用；
            问别人的记录、问通用茶知识时不要调用（也无权调用）。
            参数 limit 可选，默认 5 条，最多 10 条。""";

    /** 未登录文案：访客绑定实例的固定返回——不能让模型去「猜」一个用户。 */
    static final String NOT_LOGGED_IN = "当前未登录，无法读取品鉴记录。请提示用户登录后再问；本问题请按通用茶类常识作答，"
            + "不得在回答中出现「记录」「查询」「命中」等内部机制词，也不要声明本次未取到记录依据。";

    /** 空记录文案。 */
    static final String EMPTY = "暂无品鉴记录。可以建议用户先完成一次冲泡品鉴再来回顾。";

    /** 异常文案。 */
    static final String ERROR = "品鉴记录暂不可用。请按通用茶类常识作答；"
            + "不得在回答中出现「记录」「查询」「命中」等内部机制词，也不要声明本次未取到记录依据。";

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final int DEFAULT_LIMIT = 5;
    private static final int MAX_LIMIT = 10;

    private final TastingRecordRepository recordRepository;
    /**
     * 绑定的用户 id：单例为 null（不能查），boundTo 每请求复制一份真实值。
     * 非 final 故意为之——照 {@link CultureQueryTools#collectingInto} 试点模式：
     * 单构造器被 Spring 自动选用，绑定实例改字段而不是走第二个构造器
     * （两个构造器会让 Spring 回退无参构造器，启动即炸）。
     */
    private Integer userId;

    /** Spring 单例构造（userId=null = 不可用，只用于被 boundTo 复制）。 */
    public TastingRecordTools(TastingRecordRepository recordRepository) {
        this.recordRepository = recordRepository;
    }

    /**
     * 按请求用户绑定一个可查的实例（userId 由服务端传入，不经过模型参数）。
     * 为什么每请求复制：单例字段是共享状态，并发请求会把 A 用户的记录塞进 B 的回复。
     */
    public TastingRecordTools boundTo(Integer userId) {
        TastingRecordTools bound = new TastingRecordTools(recordRepository);
        bound.userId = userId;
        return bound;
    }

    /**
     * 查当前绑定用户的最近品鉴记录 + 平均综合分。
     *
     * @param limit 条数（可选，默认 5，夹到 1-10）
     * @return 结构化精简文本；未登录为 {@link #NOT_LOGGED_IN}；无记录为 {@link #EMPTY}；异常为 {@link #ERROR}
     */
    @Tool(name = TOOL_NAME, description = TOOL_DESCRIPTION)
    public String myTastingRecords(
            @ToolParam(description = "返回条数，可选，默认 5，最多 10", required = false) Integer limit) {
        if (userId == null) {
            return NOT_LOGGED_IN;
        }
        try {
            int n = limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(limit, MAX_LIMIT));
            List<TastingRecord> records = recordRepository
                    .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, n)).getContent();
            if (records.isEmpty()) {
                return EMPTY;
            }
            return render(records);
        } catch (Exception e) {
            log.warn("my_tasting_records 工具查询失败：{}", e.getMessage());
            return ERROR;
        }
    }

    private String render(List<TastingRecord> records) {
        StringBuilder sb = new StringBuilder("【我的品鉴记录·最近 ").append(records.size()).append(" 条】\n");
        double scoredSum = 0;
        int scoredCount = 0;
        for (int i = 0; i < records.size(); i++) {
            TastingRecord r = records.get(i);
            sb.append(i + 1).append(". ").append(r.getTeaName());
            if (r.getBrewTemp() != null || r.getBrewTime() != null) {
                sb.append(" | ").append(r.getBrewTemp() == null ? "?" : r.getBrewTemp() + "℃")
                        .append(' ').append(r.getBrewTime() == null ? "?" : r.getBrewTime() + "秒")
                        .append(' ').append(r.getInfusions() == null ? "?" : r.getInfusions() + "泡");
            }
            if (r.getOverallScore() != null) {
                sb.append(" | 综合分 ").append(String.format("%.1f", r.getOverallScore()));
                scoredSum += r.getOverallScore();
                scoredCount++;
            }
            if (r.getCreatedAt() != null) {
                sb.append(" | ").append(r.getCreatedAt().format(DATE));
            }
            sb.append('\n');
        }
        if (scoredCount > 0) {
            sb.append("平均综合分：").append(String.format("%.1f", scoredSum / scoredCount))
                    .append("（共 ").append(scoredCount).append(" 条有评分记录）");
        }
        return sb.toString().trim();
    }
}
