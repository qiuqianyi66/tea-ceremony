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
import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import com.tea.culture.vo.PersonItem;
import com.tea.culture.vo.TeaItem;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.CallResponseSpec;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

/** LibrarianAgent 专家测试（F-S1-3）：RAG 命中带出处 / 空命中说明 / key 缺失 502 / 计量旁路。 */
class LibrarianAgentTest {

    private final ChatClient.Builder builder = mock(ChatClient.Builder.class);
    private final ChatClient chatClient = mock(ChatClient.class);
    private final ChatClientRequestSpec reqSpec = mock(ChatClientRequestSpec.class);
    private final CallResponseSpec callSpec = mock(CallResponseSpec.class);
    private final ChatResponse response = mock(ChatResponse.class);
    private final ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
    private final CultureSearchService search = mock(CultureSearchService.class);
    private final AiUsageLogger usageLogger = mock(AiUsageLogger.class);
    private final PromptService promptService = mock(PromptService.class);

    private LibrarianAgent agent(String apiKey) {
        when(builder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(reqSpec);
        when(reqSpec.system(anyString())).thenReturn(reqSpec);
        when(reqSpec.user(anyString())).thenReturn(reqSpec);
        when(reqSpec.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(response);
        when(response.getMetadata()).thenReturn(metadata);
        when(metadata.getModel()).thenReturn("qwen-plus");
        when(metadata.getUsage()).thenReturn(null);
        return new LibrarianAgent(builder, search, usageLogger, promptService, apiKey);
    }

    private static AiChatRequest question(String q) {
        return new AiChatRequest(List.of(new ChatMessageDto("user", q)), "librarian");
    }

    private void mockLlmReply(String text) {
        Generation generation = mock(Generation.class);
        AssistantMessage output = mock(AssistantMessage.class);
        when(response.getResult()).thenReturn(generation);
        when(generation.getOutput()).thenReturn(output);
        when(output.getText()).thenReturn(text);
    }

    @Test
    void ragHitReturnsContentWithSources() {
        LibrarianAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(
                List.of(new TeaItem(1, "龙井", "tea")),
                List.of(new PersonItem(1, "陆羽", "唐", "person")),
                List.of(),
                List.of()));
        mockLlmReply("龙井产于西湖产区，陆羽《茶经》有载。");

        AiChatVo vo = agent.chat(null, question("讲讲龙井"));

        assertTrue(vo.content().contains("龙井"));
        assertEquals(List.of("茶·龙井", "人·陆羽"), vo.sources());
    }

    @Test
    void emptyHitFallsBackToGeneralKnowledge() {
        LibrarianAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));
        mockLlmReply("知识库未命中，以下为常识回答：……");

        AiChatVo vo = agent.chat(null, question("完全冷门的问题"));

        assertTrue(vo.sources().isEmpty());
    }

    @Test
    void missingKeyThrowsBadGateway() {
        LibrarianAgent agent = agent("disabled");
        assertThrows(BadGatewayException.class, () -> agent.chat(null, question("讲讲龙井")));
    }

    @Test
    void successFallsUsageLog() {
        LibrarianAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));
        mockLlmReply("回答");

        agent.chat(null, question("讲讲茶"));

        verify(usageLogger).save(isNull(), eq(question("讲讲茶")), eq(response), anyInt());
    }
}
