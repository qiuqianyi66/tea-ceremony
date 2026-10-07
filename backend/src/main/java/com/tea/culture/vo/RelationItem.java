package com.tea.culture.vo;

/** 文化搜索结果·知识关系项（前端 CultureSearchResult.relations）。 */
public record RelationItem(Integer id, String relation, String source, String target, String type) {
}
