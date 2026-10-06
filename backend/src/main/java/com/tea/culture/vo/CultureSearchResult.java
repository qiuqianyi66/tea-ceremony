package com.tea.culture.vo;

import java.util.List;

/**
 * 文化搜索结果（前端 CultureSearchResult：四数组，各 ≤5）。
 */
public record CultureSearchResult(
        List<TeaItem> teas,
        List<PersonItem> people,
        List<RegionItem> regions,
        List<PoemItem> poems) {
}
