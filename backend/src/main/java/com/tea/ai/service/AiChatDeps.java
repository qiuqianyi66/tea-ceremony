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
import com.tea.ai.tool.MultiToolAgent;
import org.springframework.ai.chat.client.ChatClient;

/**
 * {@link AiChatService} 的依赖聚合（一次构造传入）。
 *
 * <p>为什么聚合成一个 record：该服务原来直接摆 18 个构造参数，是强依赖链的中心。
 * 参数一多，调用点（生产装配 + 各处测试夹具）只能靠位置对齐，加一个依赖就要改全部调用点；
 * 更麻烦的是同类型参数（多个 Agent、多个 String key）位置错配不会编译失败，
 * 只会在运行期表现为「派发到错误专家」或「读错 key」。聚合后依赖清单只有一个权威位置，
 * 调用点写字段名即可自证语义，新增依赖只改本 record 与工厂的一处。</p>
 *
 * <p>注意：record 是纯数据载体，不带 {@code @Component}。Spring 不会自动注册 record，
 * 生产装配由 {@code AiChatConfig#aiChatDeps} 显式声明（测试则直接 new）。</p>
 *
 * <p>字段顺序按语义分组，与 {@link AiChatService} 内部赋值顺序一致，便于对照阅读。</p>
 */
public record AiChatDeps(
        // ---- 模型接入：ChatClient 只 build 一次；key 按激活的 model 选用（透明代理的承重墙校验）----
        ChatClient.Builder chatClientBuilder,
        /** 激活的 ChatModel 提供商（spring.ai.model.chat）：openai（gateway profile）或 dashscope（生产）。 */
        String modelChat,
        String dashscopeApiKey,
        String openaiApiKey,

        // ---- 编排与观测：专家路由、复杂度分档、调用计量、评测 Trace ----
        AgentOrchestrator orchestrator,
        AiUsageLogger usageLogger,
        TraceRecorder traceRecorder,

        // ---- 记忆：会话归属校验、多轮锚定、消息落库 ----
        ChatMemoryService memoryService,
        // ---- 跨会话画像（F-B2）：新会话开场注入摘要 + 旧会话结束 best-effort 抽取 ----
        UserMemoryService userMemoryService,
        UserMemoryExtractor userMemoryExtractor,

        // ---- 五专家（派发目标）----
        LibrarianAgent librarianAgent,
        AdvisorAgent advisorAgent,
        TasterAgent tasterAgent,
        BrewerAgent brewerAgent,
        MentorAgent mentorAgent,

        // ---- 配额与熔断：请求入口层的粗粒度门禁（执行器层另有按 lane 分桶）----
        AiCallQuota callQuota,
        AiCircuitBreaker circuitBreaker,

        // ---- 兜底与实验：上游不可用时的第二级兜底（本地规则库）+ 兜底灰度范围 ----
        AiCallExecutor aiCallExecutor,
        LocalFallbackService localFallbackService,
        ExperimentService experimentService,

        // ---- 多工具（P2.2）：透明代理挂载的进程内 function calling 门面 ----
        MultiToolAgent multiToolAgent) {
}
