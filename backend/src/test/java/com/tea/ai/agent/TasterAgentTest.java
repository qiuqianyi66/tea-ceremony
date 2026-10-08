package com.tea.ai.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.service.AiUsageLogger;
import com.tea.ai.service.PromptService;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import com.tea.common.response.PageResult;
import com.tea.record.service.TastingRecordService;
import com.tea.record.vo.RecordVo;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.CallResponseSpec;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

/** TasterAgent 品鉴师测试（F-2）：记录命中点评 / 无记录引导 / key 缺失 502 / 计量落 taster。 */
class TasterAgentTest {

    private final ChatClient.Builder builder = mock(ChatClient.Builder.class);
    private final ChatClient chatClient = mock(ChatClient.class);
    private final ChatClientRequestSpec reqSpec = mock(ChatClientRequestSpec.class);
    private final CallResponseSpec callSpec = mock(CallResponseSpec.class);
    private final ChatResponse response = mock(ChatResponse.class);
    private final ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
    private final TastingRecordService tastingService = mock(TastingRecordService.class);
    private final AiUsageLogger usageLogger = mock(AiUsageLogger.class);
    private final PromptService promptService = mock(PromptService.class);

    private TasterAgent agent(String apiKey) {
        when(builder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(reqSpec);
        when(reqSpec.system(anyString())).thenReturn(reqSpec);
        when(reqSpec.user(anyString())).thenReturn(reqSpec);
        when(reqSpec.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(response);
        when(response.getMetadata()).thenReturn(metadata);
        when(metadata.getModel()).thenReturn("qwen-plus");
        when(metadata.getUsage()).thenReturn(null);
        return new TasterAgent(builder, tastingService, usageLogger, promptService, apiKey);
    }

    private static AiChatRequest question(String q) {
        return new AiChatRequest(List.of(new ChatMessageDto("user", q)), "taster");
    }

    private void mockLlmReply(String text) {
        Generation generation = mock(Generation.class);
        AssistantMessage output = mock(AssistantMessage.class);
        when(response.getResult()).thenReturn(generation);
        when(generation.getOutput()).thenReturn(output);
        when(output.getText()).thenReturn(text);
    }

    private static RecordVo record(String teaName) {
        return new RecordVo(1, "client-1", 1, teaName, 95, 10, 1, "山泉水", 1,
                Map.of("甜度", 8), 8.0, 1.0, "兰香", "清冽", "晴", "平静", LocalDateTime.now());
    }

    @Test
    void recordHitReturnsReviewWithRecordSources() {
        TasterAgent agent = agent("test-key");
        when(tastingService.list(eq(7), eq(1), eq(10))).thenReturn(
                PageResult.of(List.of(record("龙井")), 1, 1, 10));
        mockLlmReply("品鉴点评：龙井甜度突出，整体清冽。");

        AiChatVo vo = agent.chat(7, question("点评我最近喝的茶"));

        assertTrue(vo.content().contains("龙井"));
        assertEquals(List.of("记录·龙井"), vo.sources());
    }

    @Test
    void noRecordsGuidesToTasting() {
        TasterAgent agent = agent("test-key");
        when(tastingService.list(eq(7), eq(1), eq(10))).thenReturn(PageResult.of(List.of(), 0, 1, 10));
        mockLlmReply("暂无品鉴记录，建议先做一次记录。");

        AiChatVo vo = agent.chat(7, question("点评我的品鉴"));

        assertTrue(vo.sources().isEmpty());
    }

    @Test
    void anonymousUserSkipsRecordQuery() {
        TasterAgent agent = agent("test-key");
        mockLlmReply("请先登录并记录。");

        AiChatVo vo = agent.chat(null, question("点评"));

        assertTrue(vo.sources().isEmpty());
    }

    @Test
    void missingKeyThrowsBadGateway() {
        TasterAgent agent = agent("disabled");
        assertThrows(BadGatewayException.class, () -> agent.chat(null, question("点评")));
    }

    @Test
    void successFallsUsageLogWithTaster() {
        TasterAgent agent = agent("test-key");
        when(tastingService.list(eq(7), eq(1), eq(10))).thenReturn(PageResult.of(List.of(), 0, 1, 10));
        mockLlmReply("回答");

        agent.chat(7, question("点评"));

        verify(usageLogger).save(eq(7), eq(question("点评")), eq(response), anyInt());
    }
}
