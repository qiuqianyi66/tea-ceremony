package com.tea.culture.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * splitKeywords 纯函数单测（不依赖容器）：连接词切分 / 虚词剥离 / bigram 召回补充 / 上限约束。
 */
class CultureSearchKeywordsTest {

    @Test
    void connectiveSplit() {
        assertEquals(List.of("龙井", "普洱"), CultureSearchService.splitKeywords("龙井和普洱"));
    }

    @Test
    void shortQueryStaysWhole() {
        assertEquals(List.of("铁观音"), CultureSearchService.splitKeywords("铁观音"));
    }

    @Test
    void longSentenceBigramRecall() {
        // 旧实现："怎样" 不在切分表 → 整句一个 token → ILIKE 必 miss；
        // 新实现：怎样 切分出 "冲泡普洱熟茶"（6 字整词）+ bigram 补充 普洱/熟茶。
        List<String> kws = CultureSearchService.splitKeywords("怎样冲泡普洱熟茶");
        assertTrue(kws.contains("冲泡普洱熟茶"), "整词应保留: " + kws);
        assertTrue(kws.contains("普洱"), "bigram 应含 普洱: " + kws);
        assertTrue(kws.contains("熟茶"), "bigram 应含 熟茶: " + kws);
        assertFalse(kws.contains("怎样冲泡普洱熟茶"), "整句不应作为关键词");
    }

    @Test
    void leadingInterrogativeInLongSentence() {
        // "什么水温适合泡龙井" → 什么 切分 → 水温适合泡龙井（7 字整词）+ bigram（水温/龙井…）
        List<String> kws = CultureSearchService.splitKeywords("什么水温适合泡龙井");
        assertTrue(kws.contains("水温适合泡龙井"), "整词应保留: " + kws);
        assertTrue(kws.contains("水温"), "bigram 应含 水温: " + kws);
        assertTrue(kws.contains("龙井"), "bigram 应含 龙井: " + kws);
    }

    @Test
    void bigramCoversTailParticles() {
        // "陆羽的茶经"（5 字 ≤ 6）→ 整 token + bigram（陆羽/的茶 + 奇数尾部 茶经）
        assertEquals(List.of("陆羽的茶经", "陆羽", "的茶", "茶经"), CultureSearchService.splitKeywords("陆羽的茶经"));
    }

    @Test
    void keywordCountCapped() {
        String longSentence = "请问龙井和碧螺春和铁观音和大红袍和普洱和正山小种和六安瓜片怎么冲泡";
        List<String> kws = CultureSearchService.splitKeywords(longSentence);
        assertTrue(kws.size() <= CultureSearchService.MAX_KEYWORDS, "应受上限约束，实际 " + kws.size() + ": " + kws);
    }

    @Test
    void tokenShorterThanFourGetsNoBigram() {
        List<String> kws = CultureSearchService.splitKeywords("龙井和普洱");
        // 2 字 token 不产生 bigram（无额外切片）
        assertEquals(List.of("龙井", "普洱"), kws);
    }
}
