package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tea.support.PostgresIntegrationTestBase;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * V12 user_memory 迁移 upgrade/downgrade 往返验证（真 Postgres，Testcontainers）。
 *
 * <p>语义对齐旧 Alembic test_migrations.py：升级到最新 → 表存在；执行回滚脚本 → 表删除；
 * 重放上升级 SQL → 表重建且功能可用。Flyway 不原生支持 downgrade，回滚脚本是
 * .harness/changes/user-memory/rollback.sql（DROP TABLE CASCADE），这里真跑一遍证明成对可回滚。</p>
 *
 * <p>为什么用 @DataJpaTest 切片而非全量上下文：本测试只验证 schema 往返，不需要 Web/Security；
 * 切片启动时 Flyway 已跑全部迁移（含 V12），Hibernate validate 同时钉住实体与迁移对齐。</p>
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
class UserMemoryMigrationRoundTripTest extends PostgresIntegrationTestBase {

    @Autowired
    private JdbcTemplate jdbc;

    private long tableExists(String name) {
        Long cnt = jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name=?",
                Long.class, name);
        return cnt == null ? 0 : cnt;
    }

    private long indexExists(String name) {
        Long cnt = jdbc.queryForObject(
                "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname=?",
                Long.class, name);
        return cnt == null ? 0 : cnt;
    }

    private long constraintExists(String name) {
        Long cnt = jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_name=?",
                Long.class, name);
        return cnt == null ? 0 : cnt;
    }

    @Test
    void flywayBootstrapCreatesTable_rollbackDrops_reapplySucceeds() throws IOException {
        // 1. Flyway 启动迁移（V1..V12）→ user_memory 表 + 唯一索引 + FK + CHECK 就位
        assertThat(tableExists("user_memory")).isEqualTo(1);
        assertThat(indexExists("uk_user_memory_user_key")).isEqualTo(1);
        assertThat(indexExists("ix_user_memory_user_id")).isEqualTo(1);
        assertThat(constraintExists("fk_user_memory_user_id")).isEqualTo(1);
        assertThat(constraintExists("ck_user_memory_key")).isEqualTo(1);

        // 2. 执行 rollback.sql（与 .harness/changes/user-memory/rollback.sql 同语句）→ 表随 CASCADE 删除
        jdbc.execute("DROP TABLE IF EXISTS user_memory CASCADE");
        assertThat(tableExists("user_memory")).isEqualTo(0);

        // 3. 重放 V12 up SQL（从 classpath 读 Flyway 迁移原文）→ 表重建
        String up = readClasspath("db/migration/V12__user_memory.sql");
        jdbc.execute(up);
        assertThat(tableExists("user_memory")).isEqualTo(1);
        assertThat(indexExists("uk_user_memory_user_key")).isEqualTo(1);

        // 4. 功能可用：落一行画像 + 读回；CHECK 约束拒绝非法 key
        jdbc.update("INSERT INTO users (username, display_name) VALUES ('rt_b14', 'RT')");
        Integer userId = jdbc.queryForObject(
                "SELECT id FROM users WHERE username='rt_b14'", Integer.class);
        jdbc.update("INSERT INTO user_memory (user_id, key, value) VALUES (?, 'restriction', '忌绿茶')", userId);
        String value = jdbc.queryForObject(
                "SELECT value FROM user_memory WHERE user_id=? AND key='restriction'", String.class, userId);
        assertThat(value).isEqualTo("忌绿茶");

        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO user_memory (user_id, key, value) VALUES (?, 'bogus', 'x')", userId))
                .isInstanceOf(Exception.class)
                .hasMessageContaining("ck_user_memory_key");
    }

    private static String readClasspath(String path) throws IOException {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
