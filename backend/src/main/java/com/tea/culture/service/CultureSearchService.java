package com.tea.culture.service;

import com.tea.culture.vo.CultureSearchResult;
import com.tea.culture.vo.PersonItem;
import com.tea.culture.vo.PoemItem;
import com.tea.culture.vo.RegionItem;
import com.tea.culture.vo.TeaItem;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 文化搜索服务（跨 4 表 ILIKE，各 limit 5；与旧 FastAPI culture_service 同逻辑）。
 * 用 JdbcTemplate 只读检索（避免为单搜索建 3 个实体）；参数化查询防注入。
 */
@Service
public class CultureSearchService {

    private final JdbcTemplate jdbcTemplate;

    public CultureSearchService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public CultureSearchResult search(String q) {
        if (q == null || q.isBlank()) {
            return new CultureSearchResult(List.of(), List.of(), List.of(), List.of());
        }
        String like = "%" + q.trim() + "%";

        List<TeaItem> teas = jdbcTemplate.query(
                "SELECT id, name FROM teas WHERE name ILIKE ? LIMIT 5",
                (rs, n) -> new TeaItem(rs.getInt("id"), rs.getString("name"), "tea"),
                like);

        List<PersonItem> people = jdbcTemplate.query(
                "SELECT id, name, dynasty FROM tea_people WHERE name ILIKE ? LIMIT 5",
                (rs, n) -> new PersonItem(rs.getInt("id"), rs.getString("name"), rs.getString("dynasty"), "person"),
                like);

        List<RegionItem> regions = jdbcTemplate.query(
                "SELECT id, name, province FROM tea_regions WHERE name ILIKE ? LIMIT 5",
                (rs, n) -> new RegionItem(rs.getInt("id"), rs.getString("name"), rs.getString("province"), "region"),
                like);

        List<PoemItem> poems = jdbcTemplate.query(
                "SELECT id, title, author FROM tea_poems WHERE content ILIKE ? LIMIT 5",
                (rs, n) -> new PoemItem(rs.getInt("id"), rs.getString("title"), rs.getString("author"), "poem"),
                like);

        return new CultureSearchResult(teas, people, regions, poems);
    }
}
