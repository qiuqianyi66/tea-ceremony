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
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import com.tea.culture.vo.ProcessItem;
import com.tea.culture.vo.TeaItem;
import com.tea.culture.vo.TeawareItem;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.CallResponseSpec;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

/** BrewerAgent 冲泡师测试（F-3）：命中带工艺/茶器来源 / 空命中说明 / key 缺失 502 / 计量落 brewer。 */
class BrewerAgentTest {

    private final ChatClient.Builder builder = mock(ChatClient.Builder.class);
    private final ChatClient chatClient = mock(ChatClient.class);
    private final ChatClientRequestSpec reqSpec = mock(ChatClientRequestSpec.class);
    private final CallResponseSpec callSpec = mock(CallResponseSpec.class);
    private final ChatResponse response = mock(ChatResponse.class);
    private final ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
    private final CultureSearchService search = mock(CultureSearchService.class);
    private final AiUsageLogger usageLogger = mock(AiUsageLogger.class);

    private BrewerAgent agent(String apiKey) {
        when(builder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(reqSpec);
        when(reqSpec.system(anyString())).thenReturn(reqSpec);
        when(reqSpec.user(anyString())).thenReturn(reqSpec);
        when(reqSpec.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(response);
        when(response.getMetadata()).thenReturn(metadata);
        when(metadata.getModel()).thenReturn("qwen-plus");
        when(metadata.getUsage()).thenReturn(null);
        return new BrewerAgent(builder, search, usageLogger, apiKey);
    }

    private static AiChatRequest question(String q) {
        return new AiChatRequest(List.of(new ChatMessageDto("user", q)), "brewer");
    }

    private void mockLlmReply(String text) {
        Generation generation = mock(Generation.class);
        AssistantMessage output = mock(AssistantMessage.class);
        when(response.getResult()).thenReturn(generation);
        when(generation.getOutput()).thenReturn(output);
        when(output.getText()).thenReturn(text);
    }

    @Test
    void hitReturnsContentWithProcessAndTeawareSources() {
        BrewerAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(
                List.of(new TeaItem(1, "凤凰单丛", "tea")),
                List.of(),
                List.of(),
                List.of(),
                List.of(new TeawareItem(1, "盖碗", "teaware")),
                List.of(),
                List.of(),
                List.of(new ProcessItem(1, "工夫茶冲泡", "乌龙茶", "process"))));
        mockLlmReply("冲泡方案：盖碗，水温 98℃，快进快出。");

        AiChatVo vo = agent.chat(null, question("怎么泡凤凰单丛"));

        assertTrue(vo.content().contains("盖碗"));
        assertEquals(List.of("茶·凤凰单丛", "茶器·盖碗", "工艺·工夫茶冲泡"), vo.sources());
    }

    @Test
    void emptyHitFallsBackToGeneralKnowledge() {
        BrewerAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));
        mockLlmReply("知识库未命中，以下为常识回答：……");

        AiChatVo vo = agent.chat(null, question("怎么泡"));

        assertTrue(vo.sources().isEmpty());
    }

    @Test
    void missingKeyThrowsBadGateway() {
        BrewerAgent agent = agent("disabled");
        assertThrows(BadGatewayException.class, () -> agent.chat(null, question("怎么泡茶")));
    }

    @Test
    void successFallsUsageLogWithBrewer() {
        BrewerAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));
        mockLlmReply("回答");

        agent.chat(null, question("怎么泡茶"));

        verify(usageLogger).save(isNull(), eq(question("怎么泡茶")), eq(response), anyInt());
    }
}
