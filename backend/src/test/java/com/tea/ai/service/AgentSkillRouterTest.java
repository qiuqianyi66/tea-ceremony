package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * AgentSkillRouter 领域检测行为测试（T08，ADR-017）：
 * 纯逻辑单测——固定顺序命中 / 未命中 null / 同词多领域按声明序。
 */
class AgentSkillRouterTest {

    private AgentSkillRouter router;

    @BeforeEach
    void setUp() {
        // repository 仅 load 用；detect 为纯逻辑
        router = new AgentSkillRouter(null);
    }

    @Test
    void detectTeawareKeywordReturnsTeawareDomain() {
        assertThat(router.detect("紫砂壶和盖碗泡铁观音有什么区别？")).isEqualTo("teaware");
        assertThat(router.detect("什么是公道杯？")).isEqualTo("teaware");
    }

    @Test
    void detectRegionKeywordReturnsRegionDomain() {
        assertThat(router.detect("武夷岩茶和安溪铁观音的产区差异")).isEqualTo("region");
    }

    @Test
    void detectPersonKeywordReturnsPersonDomain() {
        assertThat(router.detect("陆羽的茶经讲了什么？")).isEqualTo("person");
    }

    @Test
    void detectPoemKeywordReturnsPoemDomain() {
        assertThat(router.detect("卢仝的七碗茶诗怎么解读？")).isEqualTo("poem");
    }

    @Test
    void detectNonCultureQuestionReturnsNull() {
        assertThat(router.detect("今天天气怎么样？")).isNull();
    }

    @Test
    void detectBlankReturnsNull() {
        assertThat(router.detect("")).isNull();
        assertThat(router.detect(null)).isNull();
    }

    @Test
    void detectOverlappingKeywordPrefersDeclarationOrder() {
        // "陆羽" 仅 person 命中；"茶诗" 命中 poem（声明序 teaware→poem→region→person）
        assertThat(router.detect("茶诗中的陆羽形象")).isEqualTo("poem");
    }
}
