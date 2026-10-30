package com.tea.culture.embedding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

/**
 * OnnxEmbeddingModel 真模型单测（B1.1）。
 *
 * <p>模型文件在仓库外（D:\models\bge-large-zh-v1.5-onnx\，禁提交）。CI/无模型机上
 * assumeTrue 自动 skip，不阻断构建；本机（模型就位）真跑验证三件事：
 * <ol>
 *   <li>encode 确定性：同输入两次编码逐位一致（LRU 缓存与 pgvector 相似度计算的前提）；</li>
 *   <li>维度 = 1024 且向量 L2 归一化（错配毁召回——culture_chunks.embedding vector(1024)）；</li>
 *   <li>语义区分度：同义句余弦 > 随机句余弦（tokenizer/池化/归一化整条链路正确性的端到端证据）。</li>
 * </ol>
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OnnxEmbeddingModelTest {

    private static final Path MODEL_DIR = Path.of("D:", "models", "bge-large-zh-v1.5-onnx");
    private OnnxEmbeddingModel model;

    @BeforeAll
    void setUp() throws Exception {
        boolean present = Files.exists(MODEL_DIR.resolve("model.onnx"))
                && Files.exists(MODEL_DIR.resolve("vocab.txt"));
        assumeTrue(present, "模型文件不在本机（CI），skip 真模型单测");
        model = new OnnxEmbeddingModel(MODEL_DIR);
    }

    @Test
    void encodeIsDeterministic() {
        float[] a = model.encode("黑茶怎么泡最好喝");
        float[] b = model.encode("黑茶怎么泡最好喝");
        assertEquals(a.length, b.length);
        for (int i = 0; i < a.length; i++) {
            assertEquals(a[i], b[i], 1e-7f, "同输入两次编码必须逐位一致");
        }
    }

    @Test
    void dimensionIs1024AndL2Normalized() {
        float[] v = model.encode("武夷岩茶大红袍");
        assertEquals(1024, v.length, "维度必须对齐 culture_chunks.embedding vector(1024)");
        double norm = 0;
        for (float x : v) {
            norm += x * x;
        }
        assertEquals(1.0, Math.sqrt(norm), 1e-4, "embedding 必须 L2 归一化（余弦检索前提）");
    }

    @Test
    void batchEncodeMatchesSingleEncode() {
        // padding 正确性：batch 内短句 padding mask 不能污染 CLS 输出
        String a = "西湖龙井";
        String b = "紫砂壶适合泡什么茶";
        List<float[]> batch = model.encode(List.of(a, b));
        float[] singleA = model.encode(a);
        assertEquals(batch.size(), 2);
        for (int i = 0; i < 1024; i++) {
            assertEquals(batch.get(0)[i], singleA[i], 1e-5f, "batch 编码与单条编码必须一致");
        }
    }

    @Test
    void synonymousSentencesScoreHigherThanRandom() {
        String related = "大红袍属于什么茶类";
        String synonym = "武夷岩茶大红袍是乌龙茶吗";
        String random = "陆羽在唐代写下了茶经";

        float[] eRelated = model.encode(related);
        float[] eSynonym = model.encode(synonym);
        float[] eRandom = model.encode(random);

        double cosSyn = cosine(eRelated, eSynonym);
        double cosRand = cosine(eRelated, eRandom);
        System.out.printf("cos(related,synonym)=%.4f  cos(related,random)=%.4f%n", cosSyn, cosRand);
        assertTrue(cosSyn > cosRand,
                "同义句余弦(" + cosSyn + ")应高于随机句余弦(" + cosRand + ")——tokenizer/池化/归一化链路有误");
        assertTrue(cosSyn > 0.5, "同义句余弦应达到合理水平(>0.5)，实际=" + cosSyn);
    }

    private static double cosine(float[] a, float[] b) {
        double dot = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
        }
        return dot; // 向量已 L2 归一化，点积即余弦
    }
}
