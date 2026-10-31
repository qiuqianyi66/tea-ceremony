package com.tea.ai.tool;

import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import com.tea.record.entity.TastingRecord;
import com.tea.record.repository.TastingRecordRepository;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

/**
 * 冲泡建议编排工具（多工具 Agent 单元，组合 ②冲泡参数 + ③品鉴记录 + ①文化检索）。
 *
 * <p>它是「一把抓」的入口：用户问「铁观音怎么泡」时，模型调一次本工具，
 * 直接拿到参数 + 本人历史 + 风味/文化备注的组装文本，不必连调三个工具。
 * 内部是普通 Java 组合（不是模型侧编排），各小节独立降级——参数查不到就不附历史，
 * 文化检索失败就省略文化小节，绝不整段失败。</p>
 *
 * <p>userId 绑定纪律同 {@link TastingRecordTools}：身份由服务端 boundTo 传入，不经过模型参数。</p>
 */
@Slf4j
@Component
public class BrewAdviceTools {

    /** 工具名：模型侧契约。 */
    public static final String TOOL_NAME = "brew_advice";

    static final String TOOL_DESCRIPTION = """
            生成一份完整冲泡建议：组合茶库参数（水温/出汤/投茶量）、本人历史品鉴记录（喝过几次/平均分）、风味与文化备注。
            什么时候该调用：用户问「这款茶怎么泡最好」「帮我规划一下泡 X 茶的方案」这类需要参数+历史一起给的综合问题时调用；
            只想算一个数字（水温/投茶量）单独用 brew_params，只想看历史记录单独用 my_tasting_records。
            参数 teaName 传具体茶名；vesselMl 可选（器皿容量 ml，如 150）。""";

    static final String ERROR = "冲泡建议暂不可用。请直接按六大茶类通用常识作答；"
            + "不得在回答中出现「茶库」「记录」「查询」「命中」等内部机制词，也不要声明本次未取到依据。";

    private final BrewParamTools brewParamTools;
    private final TastingRecordRepository recordRepository;
    private final CultureSearchService cultureSearchService;
    /**
     * 绑定用户 id（单例 null；boundTo 复制真实值）。非 final 故意为之——
     * 照 {@link CultureQueryTools#collectingInto} 试点模式：单构造器被 Spring 自动选用，
     * 绑定实例改字段而不是走第二个构造器（两个构造器会让 Spring 回退无参构造器，启动即炸）。
     */
    private Integer userId;

    public BrewAdviceTools(BrewParamTools brewParamTools,
                           TastingRecordRepository recordRepository,
                           CultureSearchService cultureSearchService) {
        this.brewParamTools = brewParamTools;
        this.recordRepository = recordRepository;
        this.cultureSearchService = cultureSearchService;
    }

    /** 按请求用户绑定（历史小节只查本人；模型参数无法伪造 userId）。 */
    public BrewAdviceTools boundTo(Integer userId) {
        BrewAdviceTools bound = new BrewAdviceTools(brewParamTools, recordRepository, cultureSearchService);
        bound.userId = userId;
        return bound;
    }

    /**
     * 组合冲泡建议：参数（brew_params 同口径）+ 本人历史 + 文化备注。
     *
     * @param teaName  茶名
     * @param vesselMl 器皿容量 ml（可选）
     * @return 组装文本；整体异常为 {@link #ERROR}
     */
    @Tool(name = TOOL_NAME, description = TOOL_DESCRIPTION)
    public String brewAdvice(
            @ToolParam(description = "具体茶名，如 铁观音/西湖龙井/大红袍") String teaName,
            @ToolParam(description = "器皿容量 ml，可选，如 150 表示 150ml 盖碗", required = false) Integer vesselMl) {
        try {
            StringBuilder sb = new StringBuilder("【冲泡建议】");
            // 小节一：冲泡参数（复用 brew_params 的同口径查询；未命中则该小节给类目基准或省略）
            String params = brewParamTools.brewParams(teaName, vesselMl);
            if (params != null && !params.startsWith(BrewParamTools.NO_MATCH)) {
                sb.append('\n').append(params);
            }
            // 小节二：本人历史（仅绑定了登录用户才附；访客小节省略，不报错）
            if (userId != null && teaName != null && !teaName.isBlank()) {
                String history = renderHistory(teaName.trim());
                if (history != null) {
                    sb.append('\n').append(history);
                }
            }
            // 小节三：文化备注（尽力而为，失败省略）
            String culture = renderCulture(teaName);
            if (culture != null) {
                sb.append('\n').append(culture);
            }
            return sb.toString().trim();
        } catch (Exception e) {
            log.warn("brew_advice 工具编排失败：{}", e.getMessage());
            return ERROR;
        }
    }

    /** 本人该茶名相关记录：近 20 条里按茶名包含过滤，给次数 + 平均分。无绑定/无记录返回 null（小节省略）。 */
    private String renderHistory(String teaName) {
        try {
            List<TastingRecord> recent = recordRepository
                    .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 20)).getContent();
            List<TastingRecord> mine = recent.stream()
                    .filter(r -> r.getTeaName() != null && r.getTeaName().contains(teaName))
                    .toList();
            if (mine.isEmpty()) {
                return null;
            }
            double avg = mine.stream().filter(r -> r.getOverallScore() != null)
                    .mapToDouble(TastingRecord::getOverallScore).average().orElse(Double.NaN);
            StringBuilder sb = new StringBuilder("本人历史：");
            sb.append("你品鉴过 ").append(mine.size()).append(" 次「").append(teaName).append("」");
            if (!Double.isNaN(avg)) {
                sb.append("，平均综合分 ").append(String.format("%.1f", avg));
            }
            return sb.toString();
        } catch (Exception e) {
            log.warn("brew_advice 历史小节失败（省略）：{}", e.getMessage());
            return null;
        }
    }

    /** 文化备注：命中时附一条名称清单（与 culture_query 同源）；未命中/异常省略小节。 */
    private String renderCulture(String teaName) {
        if (teaName == null || teaName.isBlank()) {
            return null;
        }
        try {
            CultureSearchResult hit = cultureSearchService.search(teaName.trim());
            List<String> teas = hit.teas().stream().map(t -> t.name()).toList();
            if (teas.isEmpty()) {
                return null;
            }
            return "文化备注：茶库条目「" + String.join("、", teas) + "」（作答可标注出处）";
        } catch (Exception e) {
            log.warn("brew_advice 文化小节失败（省略）：{}", e.getMessage());
            return null;
        }
    }
}
