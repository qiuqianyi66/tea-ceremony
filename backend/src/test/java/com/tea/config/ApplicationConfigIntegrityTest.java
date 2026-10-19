package com.tea.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.DuplicateKeyException;
import org.yaml.snakeyaml.constructor.SafeConstructor;

/**
 * 主配置结构门禁（2026-10-19 生产事故回归）。
 *
 * <p>事故：main 的 {@code application.yml} 有两个顶层 {@code tea:} 键，容器启动即
 * {@code DuplicateKeyException}，frontend 因 depends_on healthy 也不启动，全站不可用；
 * 而 CI 13/13 全绿。原因是 {@code src/test/resources/application.yml} 在测试 classpath 上
 * 遮蔽了主配置，加上镜像构建走 {@code -DskipTests}，主配置从未被任何门禁解析过。
 *
 * <p>本测试直接读 {@code src/main/resources} 下的真实文件并用与运行时相同的严格模式解析。
 */
class ApplicationConfigIntegrityTest {

    private static final Path MAIN_RESOURCES = Path.of("src", "main", "resources");

    /**
     * 与 Spring Boot 运行时同一判定：SnakeYAML 默认「允许重复键」（后者覆盖前者），
     * Spring 用 {@code LoaderOptions.setAllowDuplicateKeys(false)} 才拒。裸 {@code new Yaml()}
     * 不会抛 DuplicateKeyException——按裸用法写的门禁是空的（vacuity 用例会立刻抓到）。
     */
    private static Yaml strictYaml() {
        LoaderOptions options = new LoaderOptions();
        options.setAllowDuplicateKeys(false);
        return new Yaml(new SafeConstructor(options));
    }

    @Test
    void applicationYmlParsesWithNoDuplicateKeys() {
        assertDoesNotThrow(() -> load("application.yml"), "application.yml 解析失败（重复键或语法错误）");
    }

    @Test
    void profileYmlsParseWithNoDuplicateKeys() {
        assertDoesNotThrow(() -> load("application-gateway.yml"), "application-gateway.yml 解析失败");
        assertDoesNotThrow(() -> load("application-dev.yml"), "application-dev.yml 解析失败");
    }

    @Test
    void applicationYmlKeepsRequiredTopLevelSections() throws IOException {
        Map<String, Object> root = load("application.yml");
        for (String key : new String[] {"spring", "server", "tea"}) {
            assertTrue(root.containsKey(key), "application.yml 缺少顶层段: " + key);
        }

        Map<String, Object> tea = asMap(root.get("tea"), "tea");
        for (String key : new String[] {"jwt", "ratelimit", "ai"}) {
            assertTrue(tea.containsKey(key), "tea 缺少子段: " + key);
        }

        Map<String, Object> ai = asMap(tea.get("ai"), "tea.ai");
        assertTrue(ai.containsKey("complexity"), "tea.ai 缺少 complexity");
        assertTrue(ai.containsKey("resilience"), "tea.ai 缺少 resilience");
    }

    @Test
    void gatewayProfileDeclaresOpenAiChatModelWithEmbeddingDisabled() throws IOException {
        Map<String, Object> root = load("application-gateway.yml");
        Map<String, Object> spring = asMap(root.get("spring"), "spring");
        Map<String, Object> ai = asMap(spring.get("ai"), "spring.ai");
        Map<String, Object> model = asMap(ai.get("model"), "spring.ai.model");

        assertTrue("openai".equals(model.get("chat")), "gateway profile 必须把 chat 模型设为 openai");
        // 网关没有 embedding 端点：显式 none，否则 DashScopeEmbeddingModel 会拿字面 key 调百炼 401
        assertTrue("none".equals(model.get("embedding")), "gateway profile 必须显式禁用 embedding");
    }

    @Test
    void duplicateKeyDetectionIsNotVacuous() {
        // 证明门禁有牙齿：同一解析方式对 2026-10-19 事故形态（重复顶层 tea:）必须抛错
        String broken = String.join("\n",
                "spring:",
                "  application:",
                "    name: tea",
                "tea:",
                "  jwt:",
                "    secret: x",
                "tea:",
                "  ai:",
                "    quality:",
                "      enabled: false");
        assertThrows(DuplicateKeyException.class, () -> strictYaml().load(broken));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> load(String file) throws IOException {
        Path path = MAIN_RESOURCES.resolve(file);
        assertTrue(Files.exists(path), "缺少主配置: " + path.toAbsolutePath());
        String text = Files.readString(path);
        Object parsed = strictYaml().load(text);
        assertNotNull(parsed, file + " 解析结果为空");
        return (Map<String, Object>) parsed;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value, String path) {
        assertTrue(value instanceof Map, path + " 不是映射结构");
        return (Map<String, Object>) value;
    }
}
