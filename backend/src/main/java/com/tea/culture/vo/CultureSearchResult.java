package com.tea.culture.vo;

/**
 * 文化搜索结果（前端 CultureSearchResult：八数组，各 ≤5）。
 * M5-S2 扩展：+teawares/etiquettes/relations/processes（8 表 RAG，ADR-013）。
 */
public record CultureSearchResult(
        java.util.List<TeaItem> teas,
        java.util.List<PersonItem> people,
        java.util.List<RegionItem> regions,
        java.util.List<PoemItem> poems,
        java.util.List<TeawareItem> teawares,
        java.util.List<EtiquetteItem> etiquettes,
        java.util.List<RelationItem> relations,
        java.util.List<ProcessItem> processes) {

    public CultureSearchResult(java.util.List<TeaItem> teas,
                               java.util.List<PersonItem> people,
                               java.util.List<RegionItem> regions,
                               java.util.List<PoemItem> poems) {
        this(teas, people, regions, poems, java.util.List.of(), java.util.List.of(), java.util.List.of(), java.util.List.of());
    }
}
