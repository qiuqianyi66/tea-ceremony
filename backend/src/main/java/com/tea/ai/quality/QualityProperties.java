package com.tea.ai.quality;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 回答质量评分配置（tea.ai.quality.*，QualityJudgeService 的唯一参数源）。
 *
 * 为什么 enabled 默认 false：LLM-as-a-Judge 每条 trace 烧一次 token，默认打开等于让所有人默认付费；
 * 规则降级模式成本为零，需要开把 llm-enabled 关掉即可（enabled=true, llm-enabled=false）。
 *
 * 为什么用 record 构造绑定（与 AiCallPolicy 同风格）：批量大小、开关在启动后不应被改，
 * 排障时要能确定当时真正生效的值；写错的批量上限归一为默认值而不是启动失败。
 */
@ConfigurationProperties(prefix = "tea.ai.quality")
public record QualityProperties(
        /** 定时任务总开关。false = 完全不采不评（不读库、不调 LLM）。 */
        @DefaultValue("false") boolean enabled,
        /** 单次定时任务最多评分的 trace 数：控制单轮 LLM 成本与耗时。 */
        @DefaultValue("20") int batchSize,
        /** 是否允许走 LLM 评分；false = 永远走规则版（零成本，可安全看趋势）。 */
        @DefaultValue("true") boolean llmEnabled) {

    static final int DEFAULT_BATCH_SIZE = 20;
    /** 上限 200：再大就是「一次跑完历史」，要么烧钱要么超时，应该分多次跑。 */
    static final int MAX_BATCH_SIZE = 200;

    public QualityProperties {
        batchSize = batchSize <= 0 ? DEFAULT_BATCH_SIZE : Math.min(batchSize, MAX_BATCH_SIZE);
    }
}
