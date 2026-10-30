package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.tea.ai.agent.AdvisorAgent;
import com.tea.ai.agent.AgentOrchestrator;
import com.tea.ai.agent.AgentType;
import com.tea.ai.agent.BrewerAgent;
import com.tea.ai.agent.LibrarianAgent;
import com.tea.ai.agent.MentorAgent;
import com.tea.ai.agent.TasterAgent;
import com.tea.ai.experiment.service.ExperimentService;
import com.tea.ai.fallback.LocalFallbackService;
import com.tea.ai.resilience.AiCallTestSupport;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;

/**
 * 专家派发登记完整性（审计 #7：收敛散弹式改动）。
 *
 * <p>为什么需要它：新增一个专家原先要改枚举、dispatch 分支、构造注入、前端数组等多处，
 * 其中 dispatch 那处漏改**不会编译报错**，只会静默回落透明代理——专家形同不存在，且无任何提示。
 * 收敛为映射表后，本测试把「必须登记」变成硬约束：漏登记即变红。</p>
 *
 * <p>只断言登记关系，不重复既有派发行为测试（那些在 AiChatFallbackWiringTest 等处）。</p>
 */
class AgentDispatchRegistryTest {

    private static AiChatService newService() {
        return new AiChatService(new AiChatDeps(
                mock(ChatClient.Builder.class), "dashscope", "disabled", "sk-openai-test",
                mock(AgentOrchestrator.class), mock(AiUsageLogger.class), mock(TraceRecorder.class),
                mock(ChatMemoryService.class),
                mock(UserMemoryService.class), mock(UserMemoryExtractor.class),
                mock(LibrarianAgent.class), mock(AdvisorAgent.class), mock(TasterAgent.class),
                mock(BrewerAgent.class), mock(MentorAgent.class),
                mock(AiCallQuota.class), mock(AiCircuitBreaker.class),
                AiCallTestSupport.executor(), mock(LocalFallbackService.class),
                mock(ExperimentService.class)));
    }

    @Test
    @DisplayName("每个非透明代理的专家类型都已登记派发实现（漏登记即变红）")
    void everyExpertTypeIsRegistered() {
        Map<AgentType, ?> experts = newService().experts;

        for (AgentType type : AgentType.values()) {
            if (type == AgentType.CHAT) {
                continue;
            }
            assertThat(experts)
                    .as("AgentType.%s 必须在 dispatch 映射表中登记", type)
                    .containsKey(type);
        }
    }

    @Test
    @DisplayName("CHAT 不登记：与 null 同义，按设计回落透明代理")
    void chatIsNotRegisteredByDesign() {
        Map<AgentType, ?> experts = newService().experts;

        assertThat(experts).doesNotContainKey(AgentType.CHAT);
        // 登记数 = 枚举总数 - CHAT：多登记等于把透明代理挂到了某个 AgentType 上
        assertThat(experts).hasSize(AgentType.values().length - 1);
    }
}
