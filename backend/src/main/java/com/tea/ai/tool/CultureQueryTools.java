package com.tea.ai.tool;

import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * 茶文化检索工具（Tool Calling 灰度试点）。
 *
 * <p>与直接检索的区别：改造前 librarian 每次请求都无条件检索并把结果拼进 system prompt；
 * 这个工具把「要不要检索、检索什么」交给模型决策，省掉无关问题上的检索与上下文 token。</p>
 *
 * <p>三个刻意的设计：
 * ① 返回结构化精简文本而不是实体 JSON——模型只需要名称与关键属性，整个实体的字段是纯烧 token；
 * ② 空命中返回明确文案而不是 null——模型读不懂 null，但读得懂「知识库无匹配」；
 * ③ 所有异常在此吞掉并转成错误文案——工具失败应当降级成「模型没有依据」，而不是让整轮对话 500。</p>
 */
@Slf4j
@Component
public class CultureQueryTools {

    /** 工具名：模型侧看到的名字，改它等于改对外契约（提示词里的引用要同步）。 */
    public static final String TOOL_NAME = "culture_query";

    /** 工具描述：模型只凭这段话决定要不要调用，所以必须写清「什么时候该调用」。 */
    static final String TOOL_DESCRIPTION = """
            检索「一盏茶」茶文化知识库，返回茶、产区、人物、诗、茶器、茶礼、工艺的条目摘要。
            什么时候该调用：用户问到具体茶名、产区/山场、制茶工艺、茶器、茶人或茶诗等需要事实依据的文化问题时，先调用本工具再作答；
            泛泛闲聊、冲泡步骤咨询、或用户只是表达情绪时不要调用。
            参数 keyword 传具体实体名（如「龙井」「武夷山」「杀青」「陆羽」），不要把整句问句塞进来；多个实体用顿号分隔。""";

    /** 空命中文案：给模型一个明确信号——「库里没有」不等于「工具坏了」。 */
    static final String NO_MATCH = "知识库无匹配：库内暂无该关键词对应的条目。请按通用茶文化常识作答，并说明知识库未命中。";

    /** 异常文案：工具内失败降级为「模型没有依据」，绝不向上抛（抛出去就是一轮 500）。 */
    static final String ERROR = "知识库检索失败：工具暂不可用。请按通用茶文化常识作答，并说明本次未取到知识库依据。";

    /** 关键词长度上限：模型偶尔会把整段问句塞进参数，截断比让 ILIKE 扫长串更稳。 */
    static final int MAX_KEYWORD_LENGTH = 50;

    private final CultureSearchService cultureSearchService;

    /** 命中结果收集器：只有绑定实例（每请求一份）非空，Spring 单例本身不收集。 */
    private List<CultureSearchResult> sink;

    public CultureQueryTools(CultureSearchService cultureSearchService) {
        this.cultureSearchService = cultureSearchService;
    }

    /**
     * 复制一个把命中结果记进 sink 的实例，交给 {@code ChatClient.tools(...)}。
     *
     * <p>为什么每请求复制一份：单例共用字段会让并发请求把别人的出处塞进本次回复。
     * 为什么不用 ToolContext 传 sink：那要求框架把 toolContext 透传到模型内部的工具执行器，
     * 而 MethodToolCallback 在拿不到非空 ToolContext 时直接抛「ToolContext is required」——
     * 透传断掉就是整条工具路径失效。绑定实例不依赖任何框架透传，最坏结果是 sources 为空。</p>
     */
    public CultureQueryTools collectingInto(List<CultureSearchResult> sink) {
        CultureQueryTools bound = new CultureQueryTools(cultureSearchService);
        bound.sink = sink;
        return bound;
    }

    /**
     * 按关键词检索茶/产区/工艺等知识库条目。
     *
     * @param keyword 检索关键词（茶名/产区/工艺/人物等具体实体名）
     * @return 结构化精简文本；空命中为 {@link #NO_MATCH}；异常为 {@link #ERROR}
     */
    @Tool(name = TOOL_NAME, description = TOOL_DESCRIPTION)
    public String cultureQuery(
            @ToolParam(description = "检索关键词：茶名/产区名/工艺名/人物名，多个用顿号分隔，不超过 50 字") String keyword) {
        try {
            String q = keyword == null ? "" : keyword.trim();
            if (q.length() > MAX_KEYWORD_LENGTH) {
                q = q.substring(0, MAX_KEYWORD_LENGTH);
            }
            CultureSearchResult hit = cultureSearchService.search(q);
            // 只收集真实命中：空命中收进去会让 sources 出现「有出处」的假象
            if (sink != null && hasHit(hit)) {
                sink.add(hit);
            }
            return render(hit);
        } catch (Exception e) {
            log.warn("culture_query 工具检索失败：{}", e.getMessage());
            return ERROR;
        }
    }

    /** 结构化精简文本：每类一行、只带决策需要的属性；空命中给明确文案（不返回 null）。 */
    private String render(CultureSearchResult hit) {
        List<String> lines = new ArrayList<>();
        addLine(lines, "茶", hit.teas().stream().map(t -> t.name()).toList());
        addLine(lines, "产区", hit.regions().stream()
                .map(r -> r.name() + (blank(r.province()) ? "" : "（" + r.province() + "）")).toList());
        addLine(lines, "工艺", hit.processes().stream()
                .map(p -> p.name() + (blank(p.teaCategory()) ? "" : "（" + p.teaCategory() + "）")).toList());
        addLine(lines, "茶器", hit.teawares().stream().map(t -> t.name()).toList());
        addLine(lines, "人物", hit.people().stream()
                .map(p -> p.name() + (blank(p.dynasty()) ? "" : "（" + p.dynasty() + "）")).toList());
        addLine(lines, "茶礼", hit.etiquettes().stream().map(e -> e.name()).toList());
        addLine(lines, "诗", hit.poems().stream()
                .map(p -> "《" + p.title() + "》" + (blank(p.author()) ? "" : "（" + p.author() + "）")).toList());
        addLine(lines, "关系", hit.relations().stream().map(r -> r.relation()).toList());
        if (lines.isEmpty()) {
            return NO_MATCH;
        }
        // 末尾补一句 usage 提示：告诉模型这些条目来自知识库，引用时要标出处
        lines.add("（以上来自「一盏茶」知识库，引用时标注出处；未列出的内容按常识作答并说明知识库未命中）");
        return String.join("\n", lines);
    }

    private void addLine(List<String> lines, String category, List<String> names) {
        List<String> kept = names.stream()
                .filter(n -> n != null && !n.isBlank())
                .distinct()
                .collect(Collectors.toList());
        if (!kept.isEmpty()) {
            lines.add("【" + category + "】" + String.join("、", kept));
        }
    }

    private static boolean hasHit(CultureSearchResult hit) {
        return !hit.teas().isEmpty() || !hit.people().isEmpty() || !hit.regions().isEmpty()
                || !hit.poems().isEmpty() || !hit.teawares().isEmpty() || !hit.etiquettes().isEmpty()
                || !hit.relations().isEmpty() || !hit.processes().isEmpty();
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
