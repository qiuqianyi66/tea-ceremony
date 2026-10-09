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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 文化搜索服务（跨 8 表 ILIKE，各 limit 5；ADR-013：M5-S2 由 4 表扩至 8 表，知识面 +75%）。
 * 用 JdbcTemplate 只读检索（避免为单搜索建 8 个实体）；参数化查询防注入。
 */
@Service
public class CultureSearchService {

    private final JdbcTemplate jdbcTemplate;

    public CultureSearchService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
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

        return new CultureSearchResult(teas, people, regions, poems, teawares, etiquettes, relations, processes);
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
