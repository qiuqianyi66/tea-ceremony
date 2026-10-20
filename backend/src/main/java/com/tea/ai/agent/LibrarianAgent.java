package com.tea.ai.agent;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.experiment.service.ExperimentService;
import com.tea.ai.resilience.AiCallExecutor;
import com.tea.ai.service.AgentSkillRouter;
import com.tea.ai.service.AiUsageLogger;
import com.tea.ai.service.PromptService;
import com.tea.ai.tool.CultureQueryTools;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import com.tea.common.exception.QuotaExceededException;
import com.tea.common.exception.UnauthorizedException;
import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 茶文化学者专家（M5-S1 试点，F-S1-3）。
 * 流程：取最后一条用户消息 → 知识库检索 → 专家 prompt（含知识库上下文）→ LLM 生成 → 回复附知识来源。
 * 承重墙不变：key 缺失/上游失败 → 502（前端 teaAI.ts 降级）；成功调用落计量（agent=librarian）。
 * 内置 prompt 常量；agent_prompts 表版本化（S2）后替换为读取表。
 *
 * <p>Tool Calling 灰度（双轨）：检索可以由模型自己按需调用（treatment），也可以像改造前那样无条件检索（control/未配置）。
 * 开关是 A/B 实验 {@value #TOOL_CALLING_EXPERIMENT}；<b>实验未配置或未运行时保持现状</b>——这一点靠
 * {@link ExperimentService#assignActive} 保证，不能用 {@code assign()}（它把「没配实验」也算成 control，
 * 等于上线一个未启用的实验就把已有检索行为改掉）。</p>
 */
@Slf4j
@Component
public class LibrarianAgent {

    /** 专家系统提示（版本化前的内置常量）。control 分支与改造前逐字一致，别在这里加工具措辞。 */
    static final String SYSTEM_PROMPT = """
            你是「一盏茶」的茶文化学者（librarian），精通中国茶史、茶器、茶诗与产区文化。
            回答规则：
            1. 优先依据下方「知识库检索结果」作答，并标注出处（茶名/人名/产区/诗名）。
            2. 知识库未命中时，用通用茶文化常识直接作答；不得在回答中出现「知识库」「检索」「命中」等内部机制词。
            3. 不编造具体茶名、茶器、历史人物；不确定处标注"待核实"。
            4. 回答简洁（≤200 字），一次一个主题。
            5. 引古籍须忠于原文语境，禁以引文暗示疗效；涉功效须说明茶是饮品而非药物。拒绝整书复制。
            """;

    /**
     * 工具调用分支的系统提示。
     * 为什么单独一份而不是改 {@link #SYSTEM_PROMPT}：control 分支的 prompt 必须与改造前逐字相同，
     * 否则「未启用实验」的请求也会被悄悄改掉回答风格。
     */
    static final String TOOL_SYSTEM_PROMPT = """
            你是「一盏茶」的茶文化学者（librarian），精通中国茶史、茶器、茶诗与产区文化。
            本回合挂载了知识库工具 culture_query：是否需要检索、检索什么关键词，由你决定。
            回答规则：
            1. 涉及具体茶名/产区/工艺/茶器/茶人/茶诗等事实时，先调用 culture_query 检索，再依据其返回结果作答，并标注出处（茶名/人名/产区/诗名）。
            2. 工具未取到条目或你没有调用工具时，用通用茶文化常识直接作答；不得在回答中出现「知识库」「检索」「命中」等内部机制词。
            3. 不编造具体茶名、茶器、历史人物；不确定处标注"待核实"。
            4. 回答简洁（≤200 字），一次一个主题。
            5. 引古籍须忠于原文语境，禁以引文暗示疗效；涉功效须说明茶是饮品而非药物。拒绝整书复制。
            """;

    /**
     * A/B 实验键：不存在或未 running 时 assignActive 返回 empty → 走直接检索（现状）。
     * 为什么是 public：{@link com.tea.ai.service.AiChatService} 要把本次请求归属到该实验，
     * 写进 trace 的 {@code plan_layer.experiments}（否则该实验永远攒不到样本，守门回滚无从触发）。
     * 键值只有一处定义，服务层不复制字面量。
     */
    public static final String TOOL_CALLING_EXPERIMENT = "ai.librarian.tool-calling";

    /** 路径调用计数：lane=direct（改造前路径）/ tool（工具调用路径），灰度期用于核对流量比例。 */
    static final String METRIC_INVOCATIONS = "tea.ai.toolcalling.invocations";
    /** 工具路径失败回落次数：持续增长说明该模型/网关不支持工具调用，应停掉实验而不是继续灰度。 */
    static final String METRIC_FALLBACK = "tea.ai.toolcalling.fallback";
    static final String LANE_DIRECT = "direct";
    static final String LANE_TOOL = "tool";
    /** 熔断隔离键（与改造前一致，两条路径共用同一 lane：是同一个专家，不该分裂熔断桶）。 */
    private static final String RESILIENCE_LANE = "librarian";

    private final ChatClient chatClient;
    private final CultureSearchService cultureSearchService;
    private final CultureQueryTools cultureQueryTools;
    private final ExperimentService experimentService;
    private final AiUsageLogger usageLogger;
    private final PromptService promptService;
    private final AgentSkillRouter skillRouter;
    /** 容错骨架（深度/熔断/超时/重试）：本类不继承 BaseExpertAgent，需自己持有执行器。 */
    private final AiCallExecutor aiCallExecutor;
    private final MeterRegistry meterRegistry;
    private final String apiKey;

    public LibrarianAgent(ChatClient.Builder chatClientBuilder,
                          CultureSearchService cultureSearchService,
                          CultureQueryTools cultureQueryTools,
                          ExperimentService experimentService,
                          AiUsageLogger usageLogger,
                          PromptService promptService,
                          AgentSkillRouter skillRouter,
                          @Value(BaseExpertAgent.AI_KEY_EXPR) String apiKey,
                          AiCallExecutor aiCallExecutor,
                          MeterRegistry meterRegistry) {
        this.chatClient = chatClientBuilder.build();
        this.cultureSearchService = cultureSearchService;
        this.cultureQueryTools = cultureQueryTools;
        this.experimentService = experimentService;
        this.usageLogger = usageLogger;
        this.promptService = promptService;
        this.skillRouter = skillRouter;
        this.apiKey = apiKey;
        this.aiCallExecutor = aiCallExecutor;
        this.meterRegistry = meterRegistry;
    }

    public AiChatVo chat(Integer userId, AiChatRequest req) {
        // key 门禁前置：两条路径都必须先过，否则「实验开着 + 没配 key」会把 502 变成别的错误
        checkKey();

        String question = lastUserMessage(req);
        boolean toolCalling = experimentService
                .assignActive(TOOL_CALLING_EXPERIMENT, subjectOf(userId, req))
                .map(ExperimentService.TREATMENT::equals)
                .orElse(false);

        if (toolCalling) {
            try {
                return chatWithToolCalling(userId, req, question);
            } catch (QuotaExceededException | UnauthorizedException e) {
                // 配额耗尽/鉴权失败是「请求本身被拒」：换路径重跑只会再烧一次配额，还会把错误语义改掉
                throw e;
            } catch (RuntimeException e) {
                // 模型不支持工具调用、参数解析失败、上游异常都可能落在这里：回落直接检索，回答不中断
                meterRegistry.counter(METRIC_FALLBACK).increment();
                log.warn("librarian 工具调用路径失败，回落直接检索：{}", e.getMessage());
            }
        }
        return chatWithDirectRetrieval(userId, req, question);
    }

    /** key 门禁：缺失/占位 disabled → 502（前端 teaAI.ts 据此降级规则引擎）。与 BaseExpertAgent 口径一致。 */
    private void checkKey() {
        if (apiKey == null || apiKey.isBlank() || "disabled".equals(apiKey)) {
            throw new BadGatewayException("AI 服务未配置（缺少 API key）");
        }
    }

    /** 改造前的路径：无条件检索 + 结果拼进 prompt。control/未配置实验时走这里，行为逐字不变。 */
    private AiChatVo chatWithDirectRetrieval(Integer userId, AiChatRequest req, String question) {
        meterRegistry.counter(METRIC_INVOCATIONS, "lane", LANE_DIRECT).increment();

        CultureSearchResult hit = cultureSearchService.search(question);
        String context = renderContext(hit);
        List<String> sources = collectSources(hit);
        String system = systemWithSkill(question, SYSTEM_PROMPT) + "\n\n【知识库检索结果】\n" + context;

        long start = System.currentTimeMillis();
        ChatResponse response = aiCallExecutor.execute(RESILIENCE_LANE, () -> chatClient.prompt()
                .system(system)
                .user(question)
                .call().chatResponse(), null);
        return toVo(userId, req, response, sources, start);
    }

    /** 工具调用路径：模型自己决定是否/如何检索；来源只从工具真实命中里收，收不到就给空数组。 */
    private AiChatVo chatWithToolCalling(Integer userId, AiChatRequest req, String question) {
        meterRegistry.counter(METRIC_INVOCATIONS, "lane", LANE_TOOL).increment();

        // 同步包装：工具可能在框架侧的其它线程执行，写入要线程安全
        List<CultureSearchResult> collected = Collections.synchronizedList(new ArrayList<>());
        CultureQueryTools tools = cultureQueryTools.collectingInto(collected);
        String system = systemWithSkill(question, TOOL_SYSTEM_PROMPT);

        long start = System.currentTimeMillis();
        // 与直接检索走同一个执行器：超时/重试/熔断不因为换路径而丢失
        ChatResponse response = aiCallExecutor.execute(RESILIENCE_LANE, () -> chatClient.prompt()
                .system(system)
                .user(question)
                .tools(tools)
                .call().chatResponse(), null);

        List<String> sources = new ArrayList<>();
        for (CultureSearchResult hit : collected) {
            sources.addAll(collectSources(hit));
        }
        // 去重：模型可能对同一主题连续调两次工具
        return toVo(userId, req, response, new ArrayList<>(new LinkedHashSet<>(sources)), start);
    }

    /** prompt 版本化 + T08 运行时技能（ADR-017）：按领域关键词命中注入子指令；未命中不膨胀上下文。 */
    private String systemWithSkill(String question, String defaultPrompt) {
        String domain = skillRouter.detect(question);
        String skill = domain == null ? "" : skillRouter.load("librarian", domain);
        String system = promptService.getPrompt("librarian", defaultPrompt);
        if (!skill.isBlank()) {
            system += "\n\n【领域技能·" + domain + "】\n" + skill;
        }
        return system;
    }

    /** 提取正文（空 → 502）+ 落计量（旁路失败不影响响应）+ 无来源时的确定性风险标记。两条路径共用。 */
    private AiChatVo toVo(Integer userId, AiChatRequest req, ChatResponse response, List<String> sources, long start) {
        String content = response.getResult().getOutput().getText();
        if (content == null) {
            throw new BadGatewayException("AI 服务返回为空");
        }
        int latency = (int) (System.currentTimeMillis() - start);
        try {
            usageLogger.save(userId, req, response, latency);
        } catch (Exception e) {
            log.warn("save usage log failed: {}", e.getMessage());
        }
        // P1-5 审计员风险标记：无来源时加确定性警示，不依赖 LLM 自觉声明。
        // 措辞约束（2026-10-19）：警示要说清「依据等级」，但不提「知识库/检索/命中」——
        // 那是系统内部机制。ragHitRate 0.13 下旧文案会让 87% 的回复首句变成系统腔自曝。
        if (sources.isEmpty()) {
            content = "以下为茶路常识，未引自站内文献。\n\n" + content;
        }
        return new AiChatVo(content, sources);
    }

    /**
     * 分桶主体：优先登录用户（体验稳定），其次会话（游客可分桶，且不会因换设备跳到另一组）。
     * 与 AiChatService 同一格式，「u:/s:」前缀让两类主体不会撞桶。
     */
    private static String subjectOf(Integer userId, AiChatRequest req) {
        if (userId != null) {
            return "u:" + userId;
        }
        Integer sessionId = req.sessionId();
        return sessionId == null ? null : "s:" + sessionId;
    }

    private String lastUserMessage(AiChatRequest req) {
        for (int i = req.messages().size() - 1; i >= 0; i--) {
            ChatMessageDto m = req.messages().get(i);
            if ("user".equals(m.role())) {
                String c = m.content();
                return c.length() > 500 ? c.substring(0, 500) : c;
            }
        }
        return "";
    }

    private String renderContext(CultureSearchResult hit) {
        StringBuilder sb = new StringBuilder();
        if (!hit.teas().isEmpty()) {
            sb.append("茶：").append(String.join("、", hit.teas().stream().map(t -> t.name()).toList())).append("\n");
        }
        if (!hit.people().isEmpty()) {
            sb.append("人：").append(String.join("、", hit.people().stream().map(p -> p.name() + (p.dynasty() == null ? "" : "（" + p.dynasty() + "）")).toList())).append("\n");
        }
        if (!hit.regions().isEmpty()) {
            sb.append("产区：").append(String.join("、", hit.regions().stream().map(r -> r.name()).toList())).append("\n");
        }
        if (!hit.poems().isEmpty()) {
            sb.append("诗：").append(String.join("、", hit.poems().stream().map(p -> p.title() + "（" + p.author() + "）").toList())).append("\n");
        }
        if (!hit.teawares().isEmpty()) {
            sb.append("茶器：").append(String.join("、", hit.teawares().stream().map(t -> t.name()).toList())).append("\n");
        }
        if (!hit.etiquettes().isEmpty()) {
            sb.append("茶礼：").append(String.join("、", hit.etiquettes().stream().map(e -> e.name()).toList())).append("\n");
        }
        if (!hit.relations().isEmpty()) {
            sb.append("关系：").append(String.join("、", hit.relations().stream()
                    .map(r -> r.relation() + "（" + r.source() + "→" + r.target() + "）").toList())).append("\n");
        }
        if (!hit.processes().isEmpty()) {
            sb.append("工艺：").append(String.join("、", hit.processes().stream()
                    .map(p -> p.name() + (p.teaCategory() == null ? "" : "（" + p.teaCategory() + "）")).toList())).append("\n");
        }
        return sb.isEmpty() ? "（无命中）" : sb.toString();
    }

    private List<String> collectSources(CultureSearchResult hit) {
        List<String> sources = new ArrayList<>();
        hit.teas().forEach(t -> sources.add("茶·" + t.name()));
        hit.people().forEach(p -> sources.add("人·" + p.name()));
        hit.regions().forEach(r -> sources.add("产区·" + r.name()));
        hit.poems().forEach(p -> sources.add("诗·" + p.title()));
        hit.teawares().forEach(t -> sources.add("茶器·" + t.name()));
        hit.etiquettes().forEach(e -> sources.add("茶礼·" + e.name()));
        hit.relations().forEach(r -> sources.add("关系·" + r.relation()));
        hit.processes().forEach(p -> sources.add("工艺·" + p.name()));
        return sources;
    }
}
