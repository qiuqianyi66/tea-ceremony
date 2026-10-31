package com.tea.ai.service;

import com.tea.ai.agent.AdvisorAgent;
import com.tea.ai.agent.AgentOrchestrator;
import com.tea.ai.agent.BrewerAgent;
import com.tea.ai.agent.LibrarianAgent;
import com.tea.ai.agent.MentorAgent;
import com.tea.ai.agent.TasterAgent;
import com.tea.ai.experiment.service.ExperimentService;
import com.tea.ai.fallback.LocalFallbackService;
import com.tea.ai.resilience.AiCallExecutor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * AI 聊天服务装配：把 {@link AiChatService} 的 18 个依赖收进 {@link AiChatDeps} 一个 Bean。
 *
 * <p>为什么必须有这个工厂方法：{@link AiChatDeps} 是 record（构造绑定），既不能被组件扫描注册，
 * Spring 也不会把散落的依赖自动拼成一个 record；不显式声明就只剩「AiChatService 回退到 18 参构造器」
 * 这一条路，重构等于没做。依赖清单只在这里声明一次，{@link AiChatService} 与测试夹具都只面对
 * {@link AiChatDeps}。</p>
 *
 * <p>为什么三个字符串仍走 {@link Value} 占位而不是配置属性类：它们直接对应 Spring AI starter 自己的
 * 配置键（spring.ai.*），与各专家 Agent 注入 key 的方式一致；新建属性类只会多一层映射，
 * 且会把「starter 配置键」复制成项目自有契约，starter 改键时更难对齐。</p>
 */
@Configuration
public class AiChatConfig {

    @Bean
    public AiChatDeps aiChatDeps(ChatClient.Builder chatClientBuilder,
                                 @Value("${spring.ai.model.chat:}") String modelChat,
                                 @Value("${spring.ai.dashscope.api-key:}") String dashscopeApiKey,
                                 @Value("${spring.ai.openai.api-key:}") String openaiApiKey,
                                 AgentOrchestrator orchestrator,
                                 AiUsageLogger usageLogger,
                                 TraceRecorder traceRecorder,
                                 ChatMemoryService memoryService,
                                 UserMemoryService userMemoryService,
                                 UserMemoryExtractor userMemoryExtractor,
                                 LibrarianAgent librarianAgent,
                                 AdvisorAgent advisorAgent,
                                 TasterAgent tasterAgent,
                                 BrewerAgent brewerAgent,
                                 MentorAgent mentorAgent,
                                 AiCallQuota callQuota,
                                 AiCircuitBreaker circuitBreaker,
                                 AiCallExecutor aiCallExecutor,
                                 LocalFallbackService localFallbackService,
                                 ExperimentService experimentService) {
        return new AiChatDeps(
                chatClientBuilder, modelChat, dashscopeApiKey, openaiApiKey,
                orchestrator, usageLogger, traceRecorder,
                memoryService,
                userMemoryService, userMemoryExtractor,
                librarianAgent, advisorAgent, tasterAgent, brewerAgent, mentorAgent,
                callQuota, circuitBreaker,
                aiCallExecutor, localFallbackService, experimentService);
    }
}
