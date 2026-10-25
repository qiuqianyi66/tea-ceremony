package com.tea.support;

import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;

/**
 * 集成测试共享基类：pgvector PG16 容器 + datasource 装配（13 个集成测试原各自粘贴的 11 行块）。
 *
 * <p>子类仍自带 @Testcontainers（保留 disabledWithoutDocker 的按类差异）；
 * 需要额外测试属性时在子类再写自己的 @DynamicPropertySource 方法即可（Spring 支持层级多方法叠加，
 * 参见 AdminCultureBackfillIntegrationTest 的 tea.admin.token）。</p>
 *
 * <p>@DirtiesContext(AFTER_CLASS) 是必须的：提取后除 AdminCultureBackfillIntegrationTest
 * （多一个 adminToken 方法，缓存键本就唯一）外的 12 个子类，@DynamicPropertySource 方法集
 * 都只剩基类的 datasource，Spring 上下文缓存键随之塌缩——同配置的测试类会复用第一个类
 * 的缓存上下文，而共享容器对象在每类结束后 stop/重启到新随机端口，复用方的连接池仍指向已死容器。
 * AFTER_CLASS（@Inherited）复原"每类一个上下文一个容器"的提取前语义。</p>
 *
 * <p>注意：本基类的容器是"同一 static 实例按类重启"，禁同 JVM 并行测试（surefire parallel /
 * JUnit platform 并行——一类 stop 会杀掉并行另一类正在用的容器）；forkCount 多 JVM 分叉不受此限，
 * 每个 JVM 各自加载基类、各自有独立 static 实例。</p>
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public abstract class PostgresIntegrationTestBase {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("pgvector/pgvector:pg16")
            .withDatabaseName("tea")
            .withUsername("tea")
            .withPassword("tea");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
