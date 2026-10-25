package com.tea.ai.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.support.PostgresIntegrationTestBase;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.server.McpSyncServer;
import java.net.HttpURLConnection;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * MCP server 装配集成测试（P1-1）：真实 Postgres（Testcontainers）+ 真实 MCP auto-config。
 * 验证：McpSyncServer bean 生成；@Tool cultureSearch 被扫描注册为 MCP 工具（协议层"专家=工具"试点）；/mcp SSE 端点匿名可达。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        // 集成测试共享单例限流器（RANDOM_PORT 同 IP），放宽防止多次调用被 429（生产限流见 application.yml）
        properties = {"tea.ratelimit.ai-anon-max=1000000", "tea.ratelimit.ai-anon-daily-max=10000000",
                "tea.ratelimit.ai-auth-max=1000000", "tea.ratelimit.login-max=1000000"})
@Testcontainers
class McpServerIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private McpSyncServer mcpServer;

    @Autowired
    private CultureSearchTool cultureSearchTool;

    @LocalServerPort
    private int port;

    @Test
    void mcpSseEndpointAnonymousAccessible() throws Exception {
        // SSE 握手：GET /mcp 应返回 200（SSE 流端点），不被 Security 拦截。
        // 注意：SSE 流连接保持打开，只做连接级验证（获取状态码即断开，不读流 body，防挂起）。
        HttpURLConnection conn = (HttpURLConnection) URI.create("http://localhost:" + port + "/mcp").toURL()
                .openConnection();
        conn.setConnectTimeout(3000);
        conn.setReadTimeout(3000);
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Accept", "text/event-stream");
        try {
            assertThat(conn.getResponseCode()).isEqualTo(200);
        } finally {
            conn.disconnect();
        }
    }

    @Test
    void mcpServerRegistersCultureSearchTool() {
        assertThat(mcpServer).isNotNull();

        List<McpSchema.Tool> tools = mcpServer.listTools();

        assertThat(tools).isNotEmpty();
        McpSchema.Tool tool = tools.stream()
                .filter(t -> "cultureSearch".equals(t.name()))
                .findFirst()
                .orElseThrow();
        assertThat(tool.description()).contains("一盏茶");
    }

    @Test
    void cultureSearchToolQueriesSeededDatabase() {
        // 经 @Tool 方法直查种子数据（V2 种子：龙井在库）
        String out = cultureSearchTool.cultureSearch("龙井");

        assertThat(out).contains("龙井");
    }
}
