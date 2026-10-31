package com.tea.ai.mcp;

import com.tea.ai.tool.BrewAdviceTools;
import com.tea.ai.tool.BrewParamTools;
import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MCP 工具注册（P1-1 试点：专家=工具，协议层解耦；P2.2 扩到 3 个）。
 * MethodToolCallbackProvider 把 @Tool bean 的方法转为 ToolCallback，
 * McpServerAutoConfiguration 自动将其合并为 MCP tools（SSE WebMVC transport 暴露 /mcp）。
 *
 * <p>P2.2 登记的两个新工具均为无会话状态：brew_params 纯查茶库；brew_advice 的历史小节
 * 在未绑定用户时小节省略（不报错、不泄露）。my_tasting_records 不在此登记——
 * 外部 MCP 调用无登录会话，单例永远回「未登录」，是死工具；它只走进程内 MultiToolAgent。</p>
 */
@Configuration
public class McpToolConfig {

    @Bean
    ToolCallbackProvider cultureSearchTools(CultureSearchTool cultureSearchTool) {
        return MethodToolCallbackProvider.builder().toolObjects(cultureSearchTool).build();
    }

    /** P2.2：冲泡参数计算（茶库命中优先，否则六大茶类基准 + 投茶量估算）。 */
    @Bean
    ToolCallbackProvider mcpBrewParamTools(BrewParamTools brewParamTools) {
        return MethodToolCallbackProvider.builder().toolObjects(brewParamTools).build();
    }

    /** P2.2：组合冲泡建议（参数 + 文化备注；外部调用无登录用户，历史小节省略）。 */
    @Bean
    ToolCallbackProvider mcpBrewAdviceTools(BrewAdviceTools brewAdviceTools) {
        return MethodToolCallbackProvider.builder().toolObjects(brewAdviceTools).build();
    }
}
