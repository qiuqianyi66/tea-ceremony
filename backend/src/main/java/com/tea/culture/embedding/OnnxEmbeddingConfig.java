package com.tea.culture.embedding;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 自托管 ONNX EmbeddingModel 装配（B1.1）。
 *
 * <p>装配规则（承重墙友好）：
 * <ul>
 *   <li>{@code tea.embedding.onnx.model-path} 为空（默认）→ <b>不建 bean</b>，
 *       CultureSearchService/ChunkBackfillService 的 ObjectProvider 自然降级纯 ILIKE/pending——与现状一致；</li>
 *   <li>配了路径但目录里缺 model.onnx / vocab.txt → 打 warn 不建 bean（同上降级），容器不崩；</li>
 *   <li>文件齐备 → 建 bean 并 @Primary：即使 DashScope/openai embedding bean 后来出现，
 *       getIfUnique/getIfAvailable 也优先自托管（禁任何 DashScope 调用的硬约束）。</li>
 * </ul>
 * 模型文件在仓库外（D:\models\...，docker 以只读卷挂载进容器），禁止提交 repo。
 */
@Slf4j
@Configuration
public class OnnxEmbeddingConfig {

    @Bean
    @org.springframework.context.annotation.Primary
    public EmbeddingModel onnxEmbeddingModel(
            @Value("${tea.embedding.onnx.model-path:}") String modelPath) throws Exception {
        if (modelPath == null || modelPath.isBlank()) {
            log.info("ONNX embedding disabled (tea.embedding.onnx.model-path 未配置) → 向量检索降级纯 ILIKE");
            return null;
        }
        Path dir = Path.of(modelPath);
        if (!Files.exists(dir.resolve("model.onnx")) || !Files.exists(dir.resolve("vocab.txt"))) {
            log.warn("ONNX embedding 模型文件缺失于 {}（需 model.onnx + vocab.txt）→ 不建 bean，向量检索降级纯 ILIKE",
                    dir.toAbsolutePath());
            return null;
        }
        return new OnnxEmbeddingModel(dir);
    }
}
