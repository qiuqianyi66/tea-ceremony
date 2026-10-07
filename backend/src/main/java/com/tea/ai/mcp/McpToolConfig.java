package com.tea.ai.mcp;

import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MCP 工具注册（P1-1 试点：专家=工具，协议层解耦）。
 * MethodToolCallbackProvider 把 CultureSearchTool 的 @Tool 方法转为 ToolCallback，
 * McpServerAutoConfiguration 自动将其合并为 MCP tools（SSE WebMVC transport 暴露 /mcp）。
 */
@Configuration
public class McpToolConfig {

    @Bean
    ToolCallbackProvider cultureSearchTools(CultureSearchTool cultureSearchTool) {
        return MethodToolCallbackProvider.builder().toolObjects(cultureSearchTool).build();
    }
}
