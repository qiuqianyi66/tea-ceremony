package com.tea.ai.vo;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * AiChatVo 契约守卫（A8，2026-11-04）。
 *
 * <p>ragTrace 是内部观测字段（culture_query 的调用次数/关键词/命中分布），只供 TraceRecorder
 * 落 ai_eval_traces.exec_layer。它**绝不能被序列化进 HTTP 响应**——一旦漏出去，等于把检索调试信息
 * 暴露给终端用户，且污染前端契约。这里用 @JsonIgnore 锁住，改 record 结构时若丢了注解，本条会红。
 */
class AiChatVoTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void ragTraceNeverLeaksIntoApiResponse() throws Exception {
        AiChatVo vo = new AiChatVo("内容", List.of("龙井"), 7, 11, 22, 33, null,
                Map.of("calls", 1, "keywords", List.of("龙井")));

        String json = objectMapper.writeValueAsString(vo);

        assertThat(json).doesNotContain("ragTrace");
        assertThat(json).doesNotContain("keywords");
        assertThat(json).contains("\"content\"");
        assertThat(vo.ragTrace()).containsKey("calls");
    }

    @Test
    void legacyConstructorsStillCompileAndDefaultRagTraceToNull() {
        assertThat(new AiChatVo("c", List.of()).ragTrace()).isNull();
        assertThat(new AiChatVo("c", List.of(), 1).sessionId()).isEqualTo(1);
        assertThat(new AiChatVo("c", List.of(), 1, 2, 3, 4).degraded()).isNull();
        assertThat(new AiChatVo("c", List.of(), 1, 2, 3, 4, true).ragTrace()).isNull();
    }
}
