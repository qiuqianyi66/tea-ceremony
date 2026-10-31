package com.tea.ai.tool;

import com.tea.tea.entity.Tea;
import com.tea.tea.repository.TeaRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * 冲泡参数工具（多工具 Agent 单元）。
 *
 * <p>数据源两条：① {@code teas} 表真实行（bestTemp/bestTime/infusions，T2.2.1 基于 TeaRepository）；
 * ② 六大茶类基准参数——与前端 {@code teaAI.ts} {@code ruleBasedReply} 的 typeHint 同口径
 * （绿茶 80-85℃/30-45s、青茶 95-100℃/15-30s 等），离线降级同款参数逻辑，不编造。</p>
 *
 * <p>设计与 {@link CultureQueryTools} 同纪律：
 * ① 命中返回结构化精简文本（模型只需数字，不要整个实体字段）；
 * ② 空命中给明确文案而不是 null；
 * ③ 异常吞掉转错误文案——工具失败降级为「模型没有依据」，绝不让整轮对话 500。</p>
 */
@Slf4j
@Component
public class BrewParamTools {

    /** 工具名：模型侧契约，改它等于改对外提示词。 */
    public static final String TOOL_NAME = "brew_params";

    static final String TOOL_DESCRIPTION = """
            查询「一盏茶」茶库的冲泡参数（水温/出汤时间/可泡次数），并按器皿容量估算投茶量。
            什么时候该调用：用户问到具体茶怎么泡、水温多少、投多少茶、某茶类的冲泡基准时，先调用本工具再作答；
            纯文化闲谈、情绪陪伴、或用户没有问冲泡问题时不要调用。
            参数 teaName 传具体茶名（如「铁观音」「西湖龙井」「大红袍」）或六大茶类名（绿茶/白茶/黄茶/青茶（乌龙）/红茶/黑茶）；
            vesselMl 可选，传器皿容量（如 150=150ml 盖碗）时额外给出克数估算。""";

    /** 空命中文案：给模型「下一步怎么做」，不复述内部机制词（措辞约束同 CultureQueryTools.NO_MATCH）。 */
    static final String NO_MATCH = "茶库未找到该茶名。请按六大茶类通用常识作答（绿茶/白茶/黄茶/青茶（乌龙）/红茶/黑茶）；"
            + "不得在回答中出现「茶库」「查询」「命中」等内部机制词，也不要声明本次未取到参数依据。";

    /** 异常文案：工具内失败降级，不向上抛。 */
    static final String ERROR = "冲泡参数暂不可用。请直接按六大茶类通用常识作答；"
            + "不得在回答中出现「茶库」「查询」「命中」等内部机制词，也不要声明本次未取到参数依据。";

    /** 关键词长度上限（与 CultureQueryTools 同：模型偶尔塞整句问句进来）。 */
    static final int MAX_KEYWORD_LENGTH = 50;

    /**
     * 六大茶类基准参数（ml/g = 每克茶对应水量，功夫茶口径；温时字符串与 teaAI.ts typeHint 一致）。
     * 顺序 = 输出顺序，用 LinkedHashMap 保序。
     */
    private static final Map<String, Baseline> CATEGORY_BASELINES = new LinkedHashMap<>();

    static {
        CATEGORY_BASELINES.put("绿茶", new Baseline("80-85℃", "30-45 秒", "3 泡", 50));
        CATEGORY_BASELINES.put("白茶", new Baseline("90-95℃", "45-60 秒", "可长期存放，新茶 3-5 泡", 25));
        CATEGORY_BASELINES.put("黄茶", new Baseline("85-90℃", "30-45 秒", "3 泡", 50));
        CATEGORY_BASELINES.put("青茶", new Baseline("95-100℃", "15-30 秒", "7-10 泡", 12));
        CATEGORY_BASELINES.put("红茶", new Baseline("90-95℃", "30-45 秒", "3-5 泡", 30));
        CATEGORY_BASELINES.put("黑茶", new Baseline("100℃ 沸水", "30-60 秒", "可泡多次", 15));
    }

    /** 类目别名：用户口语里的叫法 → 标准六大茶类键。 */
    private static final Map<String, String> CATEGORY_ALIASES = Map.of(
            "乌龙", "青茶",
            "乌龙茶", "青茶",
            "普洱", "黑茶",
            "生普", "黑茶",
            "熟普", "黑茶",
            "生茶", "黑茶",
            "熟茶", "黑茶");

    private final TeaRepository teaRepository;

    public BrewParamTools(TeaRepository teaRepository) {
        this.teaRepository = teaRepository;
    }

    /**
     * 查茶库冲泡参数（茶名精确/模糊命中优先；否则按六大茶类基准）。
     *
     * @param teaName   茶名或茶类名（如 铁观音 / 西湖龙井 / 青茶）
     * @param vesselMl  器皿容量 ml（可选；传了才给投茶量估算）
     * @return 结构化精简文本；空命中为 {@link #NO_MATCH}；异常为 {@link #ERROR}
     */
    @Tool(name = TOOL_NAME, description = TOOL_DESCRIPTION)
    public String brewParams(
            @ToolParam(description = "茶名或六大茶类名，如 铁观音/西湖龙井/青茶，不超过 50 字") String teaName,
            @ToolParam(description = "器皿容量 ml，可选，如 150 表示 150ml 盖碗", required = false) Integer vesselMl) {
        try {
            String q = teaName == null ? "" : teaName.trim();
            if (q.length() > MAX_KEYWORD_LENGTH) {
                q = q.substring(0, MAX_KEYWORD_LENGTH);
            }
            if (q.isEmpty()) {
                return NO_MATCH;
            }
            List<Tea> hits = teaRepository.findByNameContaining(q);
            if (hits != null && !hits.isEmpty()) {
                return renderTea(hits.get(0), vesselMl);
            }
            String category = matchCategory(q);
            if (category != null) {
                return renderCategory(category, vesselMl);
            }
            return NO_MATCH;
        } catch (Exception e) {
            log.warn("brew_params 工具查询失败：{}", e.getMessage());
            return ERROR;
        }
    }

    /** 茶库命中：DB 为准（bestTemp/bestTime/infusions 是真实业务数据），投茶量按该茶类目 ml/g 比换算。 */
    private String renderTea(Tea tea, Integer vesselMl) {
        StringBuilder sb = new StringBuilder();
        sb.append("茶品：").append(tea.getName());
        if (notBlank(tea.getCategory())) {
            sb.append("（").append(tea.getCategory());
            if (notBlank(tea.getOrigin())) {
                sb.append("，").append(tea.getOrigin());
            }
            sb.append("）");
        }
        sb.append('\n');
        sb.append("冲泡参数：水温 ").append(tea.getBestTemp()).append("℃，首泡约 ")
                .append(tea.getBestTime()).append(" 秒，可冲泡 ").append(tea.getInfusions()).append(" 泡\n");
        String dose = dosageText(tea.getCategory(), vesselMl);
        if (dose != null) {
            sb.append(dose).append('\n');
        }
        if (tea.getFlavor() != null && !tea.getFlavor().isEmpty()) {
            sb.append("风味：").append(String.join("、", tea.getFlavor()));
        }
        return sb.toString().trim();
    }

    /** 类目基准命中：与前端离线降级同口径的参数（不引用未命中的茶库行）。 */
    private String renderCategory(String category, Integer vesselMl) {
        Baseline b = CATEGORY_BASELINES.get(category);
        StringBuilder sb = new StringBuilder();
        sb.append("茶类基准：").append(category);
        if (category.equals("青茶")) {
            sb.append("（乌龙）");
        }
        sb.append('\n');
        sb.append("冲泡参数：水温 ").append(b.temp()).append("，").append(b.time()).append("出汤，可冲泡 ").append(b.infusions()).append('\n');
        String dose = dosageText(category, vesselMl);
        if (dose != null) {
            sb.append(dose);
        }
        return sb.toString().trim();
    }

    /** 投茶量 = 器皿容量 / 类目 ml/g 比，四舍五入到 0.5g；未传容量返回 null（不硬编器皿假设）。 */
    static String dosageText(String category, Integer vesselMl) {
        if (vesselMl == null || vesselMl <= 0) {
            return null;
        }
        Baseline b = CATEGORY_BASELINES.get(normalizeCategory(category));
        if (b == null) {
            return null;
        }
        double grams = vesselMl / (double) b.mlPerGram();
        double rounded = Math.round(grams * 2.0) / 2.0;
        return "投茶量：" + vesselMl + "ml 器皿约投 " + rounded + "g 茶"
                + "（" + (b.mlPerGram() <= 15 ? "功夫茶浓泡" : "常规") + "比例约 " + b.mlPerGram() + "ml/g）";
    }

    /** 类目匹配：先标准名，再别名（乌龙→青茶等）；大小写不敏感。 */
    static String matchCategory(String q) {
        String lower = q.toLowerCase(Locale.ROOT);
        for (String category : CATEGORY_BASELINES.keySet()) {
            if (q.contains(category)) {
                return category;
            }
        }
        for (Map.Entry<String, String> alias : CATEGORY_ALIASES.entrySet()) {
            if (lower.contains(alias.getKey().toLowerCase(Locale.ROOT))) {
                return alias.getValue();
            }
        }
        return null;
    }

    /** DB category 可能是「乌龙茶」这类叫法，统一归一到六大标准名再查基准表。 */
    private static String normalizeCategory(String category) {
        if (category == null) {
            return null;
        }
        if (CATEGORY_BASELINES.containsKey(category)) {
            return category;
        }
        String mapped = CATEGORY_ALIASES.get(category);
        return mapped == null ? category : mapped;
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    /** 茶类基准（ml/g 为功夫茶口径水量比）。 */
    private record Baseline(String temp, String time, String infusions, int mlPerGram) {
    }
}
