package com.tea.culture.service;

import com.tea.culture.vo.CultureSearchResult;
import com.tea.culture.vo.EtiquetteItem;
import com.tea.culture.vo.PersonItem;
import com.tea.culture.vo.PoemItem;
import com.tea.culture.vo.ProcessItem;
import com.tea.culture.vo.RegionItem;
import com.tea.culture.vo.RelationItem;
import com.tea.culture.vo.TeaItem;
import com.tea.culture.vo.TeawareItem;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 文化搜索服务（跨 8 表 ILIKE，各 limit 5；ADR-013：M5-S2 由 4 表扩至 8 表，知识面 +75%）。
 * 用 JdbcTemplate 只读检索（避免为单搜索建 8 个实体）；参数化查询防注入。
 * Phase 2（T05b）：叠加 culture_chunks 向量分支（pgvector 余弦 top-k，HNSW 索引）——
 * 语义结果只补足 ILIKE 未命中的空位（各类型仍 ≤5，契约不变）；
 * EmbeddingModel 不可用/调用失败 → 自动降级纯 ILIKE（检索不中断，data-layer-product-prd 硬要求）。
 */
@Slf4j
@Service
public class CultureSearchService {

    /** 向量命中最小余弦相似度（同域茶文化，0.55 经验值；低于阈值视为噪声不注入）。 */
    private static final double VECTOR_MIN_SIM = 0.55;
    /** 向量分支每类型补缺上限（ILIKE 未命中时补位；各类型总量仍 ≤5）。 */
    private static final int VECTOR_TOP_N = 3;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectProvider<EmbeddingModel> embeddingModelProvider;
    private final MeterRegistry meterRegistry;

    public CultureSearchService(JdbcTemplate jdbcTemplate,
                                ObjectProvider<EmbeddingModel> embeddingModelProvider,
                                MeterRegistry meterRegistry) {
        this.jdbcTemplate = jdbcTemplate;
        this.embeddingModelProvider = embeddingModelProvider;
        this.meterRegistry = meterRegistry;
    }

    public CultureSearchResult search(String q) {
        if (q == null || q.isBlank()) {
            return new CultureSearchResult(List.of(), List.of(), List.of(), List.of(),
                    List.of(), List.of(), List.of(), List.of());
        }
        // T11 评测抓到的真 bug（2026-10-09）：整句 %q% ILIKE 对长句必 miss（"铁观音"命中、完整问句全空）。
        // 修复：按中文连接词切分关键词，逐词 OR 参数化；无连接词时保持原句行为。
        List<String> patterns = splitKeywords(q);

        List<TeaItem> teas = jdbcTemplate.query(
                "SELECT id, name FROM teas WHERE " + likeClause(List.of("name"), patterns.size()) + " LIMIT 5",
                (rs, n) -> new TeaItem(rs.getInt("id"), rs.getString("name"), "tea"),
                likeArgs(List.of("name"), patterns));

        List<PersonItem> people = jdbcTemplate.query(
                "SELECT id, name, dynasty FROM tea_people WHERE " + likeClause(List.of("name", "description"), patterns.size()) + " LIMIT 5",
                (rs, n) -> new PersonItem(rs.getInt("id"), rs.getString("name"), rs.getString("dynasty"), "person"),
                likeArgs(List.of("name", "description"), patterns));

        List<RegionItem> regions = jdbcTemplate.query(
                "SELECT id, name, province FROM tea_regions WHERE " + likeClause(List.of("name", "description"), patterns.size()) + " LIMIT 5",
                (rs, n) -> new RegionItem(rs.getInt("id"), rs.getString("name"), rs.getString("province"), "region"),
                likeArgs(List.of("name", "description"), patterns));

        List<PoemItem> poems = jdbcTemplate.query(
                "SELECT id, title, author FROM tea_poems WHERE " + likeClause(List.of("content", "title"), patterns.size()) + " LIMIT 5",
                (rs, n) -> new PoemItem(rs.getInt("id"), rs.getString("title"), rs.getString("author"), "poem"),
                likeArgs(List.of("content", "title"), patterns));

        List<TeawareItem> teawares = jdbcTemplate.query(
                "SELECT id, name FROM teawares WHERE " + likeClause(List.of("name", "description", "culture_story"), patterns.size()) + " LIMIT 5",
                (rs, n) -> new TeawareItem(rs.getInt("id"), rs.getString("name"), "teaware"),
                likeArgs(List.of("name", "description", "culture_story"), patterns));

        List<EtiquetteItem> etiquettes = jdbcTemplate.query(
                "SELECT id, name FROM tea_etiquettes WHERE " + likeClause(List.of("name", "description"), patterns.size()) + " LIMIT 5",
                (rs, n) -> new EtiquetteItem(rs.getInt("id"), rs.getString("name"), "etiquette"),
                likeArgs(List.of("name", "description"), patterns));

        List<RelationItem> relations = jdbcTemplate.query(
                "SELECT id, relation, source_type, target_type FROM tea_relations WHERE " + likeClause(List.of("relation"), patterns.size()) + " LIMIT 5",
                (rs, n) -> new RelationItem(rs.getInt("id"), rs.getString("relation"),
                        rs.getString("source_type"), rs.getString("target_type"), "relation"),
                likeArgs(List.of("relation"), patterns));

        List<ProcessItem> processes = jdbcTemplate.query(
                "SELECT id, name, tea_category FROM tea_processes WHERE " + likeClause(List.of("name", "summary"), patterns.size()) + " LIMIT 5",
                (rs, n) -> new ProcessItem(rs.getInt("id"), rs.getString("name"), rs.getString("tea_category"), "process"),
                likeArgs(List.of("name", "summary"), patterns));

        // Phase 2（T05b）：向量分支补缺——语义结果只补 ILIKE 未命中的空位，各类型仍 ≤5
        List<VectorHit> vec = vectorHits(q);
        teas = mergeLists(teas, vec, "tea", h -> new TeaItem(h.id(), h.name(), "tea"), TeaItem::name);
        people = mergeLists(people, vec, "person", h -> new PersonItem(h.id(), h.name(), h.extra1(), "person"), PersonItem::name);
        regions = mergeLists(regions, vec, "region", h -> new RegionItem(h.id(), h.name(), h.extra1(), "region"), RegionItem::name);
        poems = mergeLists(poems, vec, "poem", h -> new PoemItem(h.id(), h.name(), h.extra1(), "poem"), PoemItem::title);
        teawares = mergeLists(teawares, vec, "teaware", h -> new TeawareItem(h.id(), h.name(), "teaware"), TeawareItem::name);
        etiquettes = mergeLists(etiquettes, vec, "etiquette", h -> new EtiquetteItem(h.id(), h.name(), "etiquette"), EtiquetteItem::name);
        processes = mergeLists(processes, vec, "process", h -> new ProcessItem(h.id(), h.name(), h.extra1(), "process"), ProcessItem::name);
        // relation 不进向量分支（数据量小、语义价值低，ILIKE relation 字段已覆盖；RelationItem 多字段元数据不足）

        return new CultureSearchResult(teas, people, regions, poems, teawares, etiquettes, relations, processes);
    }

    // ---- Phase 2 向量检索分支（T05b）----

    /** 向量命中（extra1 按类型解释：person→dynasty / region→province / poem→author / process→tea_category）。 */
    private record VectorHit(String sourceType, int id, String name, String extra1) {
    }

    /**
     * culture_chunks 语义检索（HNSW 余弦距离，< 阈值丢弃）。EmbeddingModel 不可用（无 key）或调用失败 →
     * 返回空列表（调用方自然降级为纯 ILIKE，检索不中断）。relation 类型不在向量结果内。
     */
    private List<VectorHit> vectorHits(String q) {
        // getIfUnique 而非 getIfAvailable：唯一时取（生产单 EmbeddingModel 行为不变），
        // 多候选（评测 gateway profile 下 dashscope+openai 双装配）时返回 null → no_model 降级纯 ILIKE，
        // 避免 NoUniqueBeanDefinitionException 把检索打成 500（2026-10-12 评测通道实测）。
        EmbeddingModel model = embeddingModelProvider.getIfUnique();
        if (model == null) {
            // ragHitRate 观测：无 EmbeddingModel bean（无 key）→ 向量通道整体不可用
            meterRegistry.counter("tea.culture.search.vector.degraded", "reason", "no_model").increment();
            return List.of();
        }
        float[] qv;
        try {
            qv = model.embed(q);
        } catch (Exception e) {
            log.warn("vector search degraded to keyword-only: {}", e.getMessage());
            meterRegistry.counter("tea.culture.search.vector.degraded", "reason", "embed_failed").increment();
            return List.of();
        }
        meterRegistry.counter("tea.culture.search.vector.attempted").increment();
        try {
            // pgvector 参数绑定：vector 类型须显式 ?::vector cast（float[] 无法直接绑定），与 upsert 同理
            List<VectorHit> hits = jdbcTemplate.query("""
                            SELECT c.source_type, c.source_id, c.metadata->>'sourceName' AS name,
                                   p.dynasty AS extra1
                            FROM culture_chunks c
                            LEFT JOIN tea_people p ON c.source_type = 'person' AND p.id = c.source_id
                            WHERE c.status = 'ready' AND (c.embedding <=> ?::vector) <= ?
                            ORDER BY (c.embedding <=> ?::vector) ASC
                            LIMIT ?
                            """,
                    (rs, n) -> new VectorHit(rs.getString("source_type"), rs.getInt("source_id"),
                            rs.getString("name"), rs.getString("extra1")),
                    vectorToPg(qv), 1 - VECTOR_MIN_SIM, vectorToPg(qv), VECTOR_TOP_N * 6);
            meterRegistry.counter("tea.culture.search.vector.rows").increment(hits.size());
            return hits;
        } catch (Exception e) {
            log.warn("vector search degraded to keyword-only: {}", e.getMessage());
            meterRegistry.counter("tea.culture.search.vector.degraded", "reason", "query_failed").increment();
            return List.of();
        }
    }

    /** float[] → pgvector 字面量 '[0.1,0.2,...]'（1024 维对齐 text-embedding-v3）。 */
    private String vectorToPg(float[] v) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(v[i]);
        }
        return sb.append(']').toString();
    }

    /** 向量结果补缺合并：ILIKE 结果优先，向量按 sim 序补空位（按 name 去重，总量保持 ≤5）。 */
    private <T> List<T> mergeLists(List<T> ilike, List<VectorHit> vec, String type,
                                   java.util.function.Function<VectorHit, T> mapper,
                                   java.util.function.Function<T, String> nameOf) {
        List<T> out = new ArrayList<>(ilike);
        if (vec.isEmpty() || out.size() >= 5) {
            return out;
        }
        for (VectorHit h : vec) {
            if (!type.equals(h.sourceType())) {
                continue;
            }
            if (out.size() >= 5) {
                break;
            }
            T item = mapper.apply(h);
            String n = nameOf.apply(item);
            if (out.stream().noneMatch(x -> n.equals(nameOf.apply(x)))) {
                out.add(item);
            }
        }
        return out;
    }

    /** 中文连接词切分关键词 + 剥离尾部语气虚词；
     *  无连接词且为长句时，按虚词/疑问词二次拆词（实体词典近似，防"陆羽的茶经"整句 miss）。
     *  切分碎片过短或空时回退整句（保持原行为）。
     *  注意：? 是 regex 元字符必须转义；全角？！。无需转义。 */
    private List<String> splitKeywords(String q) {
        String trimmed = q.trim();
        String[] parts = trimmed.split("和|与|以及|还有|或|、|，|,|\\?|？|\\!|！|。|\\.|\\s+");
        List<String> tokens = new ArrayList<>();
        for (String raw : parts) {
            String p = raw.replaceAll("[《》\"']", "").trim();
            if (p.isBlank()) continue;
            if (parts.length > 1 || p.length() <= 6) {
                String w = stripTailParticles(p);
                if (w.length() >= 2) tokens.add(w);
                continue;
            }
            // 无连接词长句：虚词→空格二次拆词（剥离问句助词/疑问词，保留实体名）
            for (String t : p.split("的|了|吗|呢|吧|啊|呀|哦|什么|怎么|为什么|如何|哪些|大概|讲|是|有|跟")) {
                String w = stripTailParticles(t.trim());
                if (w.length() >= 2) tokens.add(w);
            }
        }
        List<String> kws = tokens.stream().distinct().toList();
        return kws.isEmpty() ? List.of(trimmed) : kws;
    }

    /** 剥离尾部语气虚词：陆羽的→陆羽（否则 ILIKE %陆羽的% 对 name=陆羽 miss，评测 LIB-002/003 抓出）。 */
    private String stripTailParticles(String w) {
        String s = w;
        while (s.length() > 1 && "的了吗呢吧啊呀哦".indexOf(s.charAt(s.length() - 1)) >= 0) {
            s = s.substring(0, s.length() - 1);
        }
        return s;
    }

    /** fields 每列 × n 个关键词的 OR 子句（全部参数化，防注入）。 */
    private String likeClause(List<String> fields, int n) {
        StringBuilder sb = new StringBuilder();
        for (String f : fields) {
            for (int i = 0; i < n; i++) {
                if (sb.length() > 0) sb.append(" OR ");
                sb.append(f).append(" ILIKE ?");
            }
        }
        return sb.toString();
    }

    /** likeClause 对应的参数数组：每列 × 每关键词一个 %kw%。 */
    private Object[] likeArgs(List<String> fields, List<String> patterns) {
        List<Object> args = new ArrayList<>();
        for (String f : fields) {
            for (String p : patterns) args.add("%" + p + "%");
        }
        return args.toArray();
    }
}
