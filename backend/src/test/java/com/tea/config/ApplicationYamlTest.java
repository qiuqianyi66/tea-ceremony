package com.tea.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.FileSystemResource;

/**
 * 主配置 application.yml 的加载体检。
 *
 * <p>为什么需要这个测试：2026-10-19 实际踩过——给 {@code tea.ai.quality} 加配置时新起了一个
 * 顶层 {@code tea:} 键，而文件里已有 {@code tea:}。应用启动直接
 * {@code DuplicateKeyException: while constructing a mapping}，**整个服务起不来**。</p>
 *
 * <p>而 487 个测试全绿：因为 {@code src/test/resources/application.yml} 是另一份文件，
 * 单测与 {@code @SpringBootTest} 都读测试那份，主配置的语法错误无人覆盖。
 * 这类错误单元测试天然看不见，却会让一次部署直接失败——所以单独加一条加载检查。</p>
 *
 * <p>两个必须注意的点：</p>
 * <ol>
 *   <li>不能用 {@code ClassPathResource("application.yml")}：test-classes 在 classpath 前面，
 *       拿到的是测试那份配置，检查就落空了（本用例第一版正是这么错的）。必须按文件路径读。</li>
 *   <li>不能用裸 SnakeYAML 解析：它对重复键是静默覆盖，只有 Spring 的
 *       {@link YamlPropertySourceLoader} 会抛 {@code DuplicateKeyException}。</li>
 * </ol>
 */
class ApplicationYamlTest {

    /** Surefire 的工作目录是模块根（backend/），相对路径即主配置。 */
    private static final Path MAIN_YAML = Path.of("src", "main", "resources", "application.yml");

    private static List<PropertySource<?>> loadMainYaml() throws Exception {
        FileSystemResource resource = new FileSystemResource(MAIN_YAML);
        assertThat(resource.exists())
                .as("主配置未找到：%s（工作目录 %s）—— 找不到就等于没检查，必须显式失败",
                        MAIN_YAML.toAbsolutePath(), Path.of("").toAbsolutePath())
                .isTrue();
        return new YamlPropertySourceLoader().load("application", resource);
    }

    @Test
    void mainApplicationYamlLoadsWithoutDuplicateKeys() {
        assertThatCode(ApplicationYamlTest::loadMainYaml)
                .as("application.yml 必须能被 Spring 加载（顶层重复键会在这里抛 DuplicateKeyException）")
                .doesNotThrowAnyException();
    }

    @Test
    void telemetryAndAiSectionsAreKeyedUnderSingleRoots() throws Exception {
        PropertySource<?> src = loadMainYaml().get(0);

        // 这三处分别来自 ADR-026（质量评分）、ADR-023（容错执行器）、ADR-024（灰度实验），
        // 它们都挂在 tea.* 下——一旦有人再新起一个顶层 tea:，上面的用例会先红，这里再确认键路径没搬错。
        assertThat(src.containsProperty("tea.ai.quality.enabled")).isTrue();
        assertThat(src.containsProperty("tea.ai.quality.batch-size")).isTrue();
        assertThat(src.containsProperty("tea.ai.resilience.timeout-ms")).isTrue();
        assertThat(src.containsProperty("tea.circuit-breaker.failure-threshold")).isTrue();
        assertThat(src.containsProperty("management.endpoints.web.exposure.include")).isTrue();
    }
}
