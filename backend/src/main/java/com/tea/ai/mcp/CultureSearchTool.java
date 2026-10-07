package com.tea.ai.mcp;

import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import java.util.stream.Collectors;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/**
 * 文化知识库 MCP 工具（P1-1 试点：专家=工具，协议层解耦）。
 * 经 spring-ai-starter-mcp-server 自动暴露：@Tool 注解 bean 被 McpServerAnnotationScanner 扫描，
 * 成为 MCP tool（servlet transport 时外部 agent 可通过标准 MCP 协议调用）。
 * 输出：紧凑 JSON（各实体 name 列表），LLM/外部 agent 可直接消费；调用失败不抛（返回错误串，协议层健壮性）。
 */
@Component
public class CultureSearchTool {

    private final CultureSearchService cultureSearchService;

    public CultureSearchTool(CultureSearchService cultureSearchService) {
        this.cultureSearchService = cultureSearchService;
    }

    /** 按关键词检索茶文化知识库（8 表 RAG：茶/人/产区/诗/茶器/礼仪/关系/工艺，各 ≤5 条），返回紧凑 JSON。 */
    @Tool(description = "检索「一盏茶」茶文化知识库：输入关键词（如茶名/人物/产区/工艺），返回匹配的茶、人物、产区、诗、茶器、礼仪、关系、工艺名称列表（JSON），供荐茶/文化问答引用")
    public String cultureSearch(String query) {
        try {
            CultureSearchResult hit = cultureSearchService.search(query);
            return render(hit);
        } catch (Exception e) {
            return "{\"error\":\"检索失败\"}";
        }
    }

    private String render(CultureSearchResult hit) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"teas\":").append(names(hit.teas().stream()
                .map(t -> t.name()).toList()));
        sb.append(",\"people\":").append(names(hit.people().stream()
                .map(p -> p.name()).toList()));
        sb.append(",\"regions\":").append(names(hit.regions().stream()
                .map(r -> r.name()).toList()));
        sb.append(",\"poems\":").append(names(hit.poems().stream()
                .map(p -> p.title() == null ? "" : p.title()).toList()));
        sb.append(",\"teawares\":").append(names(hit.teawares().stream()
                .map(t -> t.name()).toList()));
        sb.append(",\"etiquettes\":").append(names(hit.etiquettes().stream()
                .map(e -> e.name()).toList()));
        sb.append(",\"relations\":").append(names(hit.relations().stream()
                .map(r -> r.source() + "-" + r.target()).toList()));
        sb.append(",\"processes\":").append(names(hit.processes().stream()
                .map(p -> p.name()).toList()));
        sb.append("}");
        return sb.toString();
    }

    private String names(java.util.List<String> items) {
        return "[" + items.stream()
                .filter(n -> n != null && !n.isBlank())
                .map(n -> "\"" + n.replace("\"", "\\\"") + "\"")
                .collect(Collectors.joining(",")) + "]";
    }
}
