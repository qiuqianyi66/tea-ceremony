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
import com.tea.culture.vo.RegionItem;
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

/** AdvisorAgent 荐茶师测试（F-1）：命中带茶/产区来源 / 空命中说明 / key 缺失 502 / 计量落 advisor。 */
class AdvisorAgentTest {

    private final ChatClient.Builder builder = mock(ChatClient.Builder.class);
    private final ChatClient chatClient = mock(ChatClient.class);
    private final ChatClientRequestSpec reqSpec = mock(ChatClientRequestSpec.class);
    private final CallResponseSpec callSpec = mock(CallResponseSpec.class);
    private final ChatResponse response = mock(ChatResponse.class);
    private final ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
    private final CultureSearchService search = mock(CultureSearchService.class);
    private final AiUsageLogger usageLogger = mock(AiUsageLogger.class);

    private AdvisorAgent agent(String apiKey) {
        when(builder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(reqSpec);
        when(reqSpec.system(anyString())).thenReturn(reqSpec);
        when(reqSpec.user(anyString())).thenReturn(reqSpec);
        when(reqSpec.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(response);
        when(response.getMetadata()).thenReturn(metadata);
        when(metadata.getModel()).thenReturn("qwen-plus");
        when(metadata.getUsage()).thenReturn(null);
        return new AdvisorAgent(builder, search, usageLogger, apiKey);
    }

    private static AiChatRequest question(String q) {
        return new AiChatRequest(List.of(new ChatMessageDto("user", q)), "advisor");
    }

    private void mockLlmReply(String text) {
        Generation generation = mock(Generation.class);
        AssistantMessage output = mock(AssistantMessage.class);
        when(response.getResult()).thenReturn(generation);
        when(generation.getOutput()).thenReturn(output);
        when(output.getText()).thenReturn(text);
    }

    @Test
    void hitReturnsContentWithTeaAndRegionSources() {
        AdvisorAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(
                List.of(new TeaItem(1, "龙井", "tea")),
                List.of(),
                List.of(new RegionItem(1, "西湖", "浙江", "region")),
                List.of()));
        mockLlmReply("推荐：龙井，来自西湖产区，清冽甘甜。");

        AiChatVo vo = agent.chat(null, question("推荐一款春天的绿茶"));

        assertTrue(vo.content().contains("龙井"));
        assertEquals(List.of("茶·龙井", "产区·西湖"), vo.sources());
    }

    @Test
    void emptyHitFallsBackToGeneralKnowledge() {
        AdvisorAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));
        mockLlmReply("知识库未命中，以下为常识回答：……");

        AiChatVo vo = agent.chat(null, question("随便推荐一款"));

        assertTrue(vo.sources().isEmpty());
    }

    @Test
    void missingKeyThrowsBadGateway() {
        AdvisorAgent agent = agent("disabled");
        assertThrows(BadGatewayException.class, () -> agent.chat(null, question("推荐一款茶")));
    }

    @Test
    void successFallsUsageLogWithAdvisor() {
        AdvisorAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));
        mockLlmReply("回答");

        agent.chat(null, question("推荐一款茶"));

        verify(usageLogger).save(isNull(), eq(question("推荐一款茶")), eq(response), anyInt());
    }
}
