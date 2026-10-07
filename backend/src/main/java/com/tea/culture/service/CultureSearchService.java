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
        String like = "%" + q.trim() + "%";

        List<TeaItem> teas = jdbcTemplate.query(
                "SELECT id, name FROM teas WHERE name ILIKE ? LIMIT 5",
                (rs, n) -> new TeaItem(rs.getInt("id"), rs.getString("name"), "tea"),
                like);

        List<PersonItem> people = jdbcTemplate.query(
                "SELECT id, name, dynasty FROM tea_people WHERE name ILIKE ? OR description ILIKE ? LIMIT 5",
                (rs, n) -> new PersonItem(rs.getInt("id"), rs.getString("name"), rs.getString("dynasty"), "person"),
                like, like);

        List<RegionItem> regions = jdbcTemplate.query(
                "SELECT id, name, province FROM tea_regions WHERE name ILIKE ? OR description ILIKE ? LIMIT 5",
                (rs, n) -> new RegionItem(rs.getInt("id"), rs.getString("name"), rs.getString("province"), "region"),
                like, like);

        List<PoemItem> poems = jdbcTemplate.query(
                "SELECT id, title, author FROM tea_poems WHERE content ILIKE ? OR title ILIKE ? LIMIT 5",
                (rs, n) -> new PoemItem(rs.getInt("id"), rs.getString("title"), rs.getString("author"), "poem"),
                like, like);

        List<TeawareItem> teawares = jdbcTemplate.query(
                "SELECT id, name FROM teawares WHERE name ILIKE ? OR description ILIKE ? OR culture_story ILIKE ? LIMIT 5",
                (rs, n) -> new TeawareItem(rs.getInt("id"), rs.getString("name"), "teaware"),
                like, like, like);

        List<EtiquetteItem> etiquettes = jdbcTemplate.query(
                "SELECT id, name FROM tea_etiquettes WHERE name ILIKE ? OR description ILIKE ? LIMIT 5",
                (rs, n) -> new EtiquetteItem(rs.getInt("id"), rs.getString("name"), "etiquette"),
                like, like);

        List<RelationItem> relations = jdbcTemplate.query(
                "SELECT id, relation, source_type, target_type FROM tea_relations WHERE relation ILIKE ? LIMIT 5",
                (rs, n) -> new RelationItem(rs.getInt("id"), rs.getString("relation"),
                        rs.getString("source_type"), rs.getString("target_type"), "relation"),
                like);

        List<ProcessItem> processes = jdbcTemplate.query(
                "SELECT id, name, tea_category FROM tea_processes WHERE name ILIKE ? OR summary ILIKE ? LIMIT 5",
                (rs, n) -> new ProcessItem(rs.getInt("id"), rs.getString("name"), rs.getString("tea_category"), "process"),
                like, like);

        return new CultureSearchResult(teas, people, regions, poems, teawares, etiquettes, relations, processes);
    }
}
