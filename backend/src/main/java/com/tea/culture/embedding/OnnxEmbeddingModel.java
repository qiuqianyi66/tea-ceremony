package com.tea.culture.embedding;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import ai.onnxruntime.TensorInfo;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.ai.embedding.Embedding;

/**
 * 自托管 ONNX EmbeddingModel（B1.1 向量 RAG）：bge-large-zh-v1.5 ONNX（1024 维）。
 *
 * <p>背景：DashScope text-embedding-v3 通道欠费停充（用户明确不充值），向量检索此前整体不可用
 * （culture_chunks 全 pending、检索走纯 ILIKE）。本类把 embedding 通道完全本地化——零外部 HTTP 调用。
 *
 * <p>模型：Xenova/bge-large-zh-v1.5（Transformers.js verified ONNX 导出，BERT 架构 hidden=1024，
 * 对齐 culture_chunks.embedding vector(1024) + V3 HNSW 索引，免 schema 迁移）。
 * 文件布局（目录由 tea.embedding.onnx.model-path 指定，模型文件不入 repo）：
 * <pre>
 *   &lt;model-path&gt;/model.onnx   (fp32, ~1.2GB)
 *   &lt;model-path&gt;/vocab.txt    (BERT Chinese WordPiece 词表，21128)
 * </pre>
 *
 * <p>推理管线（对齐 FlagEmbedding 官方 bge v1.5 语义）：
 * <ol>
 *   <li>BertTokenizer：lowercase + NFKC + 中文逐字切分（CJK 每字独立 token）+ 标点切分 + WordPiece 最长匹配；</li>
 *   <li>[CLS] + tokens + [SEP]，截断 510，batch 内 padding；input_ids/attention_mask/token_type_ids 全 long；</li>
 *   <li>ONNX 前向 → last_hidden_state[batch, seq, 1024]；</li>
 *   <li><b>CLS 池化</b>（bge v1.5 官方做法：取首 token 隐层）；</li>
 *   <li><b>L2 归一化</b>（pgvector cosine 距离依赖归一化向量；不归一化会让 &lt;=&gt; 余弦分数失真、阈值 VECTOR_MIN_SIM=0.55 完全错位，召回报废）。</li>
 * </ol>
 * 线程安全：OrtSession.run 官方声明线程安全；本类无内部可变状态（vocab 只读），可被检索/回填并发共享。
 */
@Slf4j
public class OnnxEmbeddingModel implements EmbeddingModel {

    /** 单条文本 token 上限（512 = [CLS]+510+[SEP]）。茶 chunk 实测 ~150-250 字，截断极少触发。 */
    private static final int MAX_SEQ_LEN = 512;
    /** WordPiece 单 piece 最大字符数（BERT 默认）；超出按 [UNK]。 */
    private static final int MAX_INPUT_CHARS_PER_WORD = 100;
    /** batch 内单次 ONNX 前向的最大条数（backfill EMBED_BATCH=10 直接打满）。 */
    private static final int MAX_BATCH = 16;

    private final OrtEnvironment env;
    private final OrtSession session;
    private final Map<String, Integer> vocab;
    private final int clsId;
    private final int sepId;
    private final int padId;
    private final int unkId;
    private final int dimensions;

    /**
     * 加载模型（启动期一次性开销：读 1.2GB ONNX 图 + 词表，约数秒）。
     *
     * @param modelDir 含 model.onnx + vocab.txt 的目录
     * @throws IOException   词表读取失败
     * @throws OrtException ONNX 会话创建失败
     */
    public OnnxEmbeddingModel(Path modelDir) throws IOException, OrtException {
        this.env = OrtEnvironment.getEnvironment();
        Path modelFile = modelDir.resolve("model.onnx");
        this.vocab = loadVocab(modelDir.resolve("vocab.txt"));

        OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
        opts.setIntraOpNumThreads(Math.max(2, Runtime.getRuntime().availableProcessors() / 2));
        opts.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
        this.session = env.createSession(modelFile.toString(), opts);

        this.clsId = id("[CLS]");
        this.sepId = id("[SEP]");
        this.padId = id("[PAD]");
        this.unkId = id("[UNK]");
        // 维度从 ONNX 输出形状读，不硬编码（换模型即报错而非静默错位）
        TensorInfo outInfo = (TensorInfo) session.getOutputInfo().values().iterator().next().getInfo();
        long[] outShape = outInfo.getShape();
        this.dimensions = (int) outShape[outShape.length - 1];
        log.info("OnnxEmbeddingModel loaded: dir={} outDim={} vocabSize={}", modelDir, dimensions, vocab.size());
    }

    // ---- EmbeddingModel SPI ----

    @Override
    public EmbeddingResponse call(EmbeddingRequest request) {
        List<Embedding> results = new ArrayList<>();
        List<String> texts = request.getInstructions();
        for (int i = 0; i < texts.size(); i += MAX_BATCH) {
            List<float[]> batch = encode(texts.subList(i, Math.min(i + MAX_BATCH, texts.size())));
            for (int j = 0; j < batch.size(); j++) {
                results.add(new Embedding(batch.get(j), i + j));
            }
        }
        return new EmbeddingResponse(results);
    }

    @Override
    public float[] embed(Document document) {
        return encode(List.of(document.getText())).get(0);
    }

    /** 批量编码（公开入口，回填管线用）；每条结果均 L2 归一化。 */
    public List<float[]> encode(List<String> texts) {
        List<List<Integer>> tokenized = new ArrayList<>(texts.size());
        int maxLen = 0;
        for (String t : texts) {
            List<Integer> ids = tokenize(t);
            tokenized.add(ids);
            maxLen = Math.max(maxLen, ids.size());
        }
        int batch = texts.size();
        long[][] inputIds = new long[batch][maxLen];
        long[][] attentionMask = new long[batch][maxLen];
        long[][] tokenTypeIds = new long[batch][maxLen];
        for (int b = 0; b < batch; b++) {
            List<Integer> ids = tokenized.get(b);
            for (int t = 0; t < maxLen; t++) {
                if (t < ids.size()) {
                    inputIds[b][t] = ids.get(t);
                    attentionMask[b][t] = 1;
                } else {
                    inputIds[b][t] = padId;
                    attentionMask[b][t] = 0;
                }
                tokenTypeIds[b][t] = 0;
            }
        }

        try (OnnxTensor idsTensor = OnnxTensor.createTensor(env, inputIds);
             OnnxTensor maskTensor = OnnxTensor.createTensor(env, attentionMask);
             OnnxTensor typeTensor = OnnxTensor.createTensor(env, tokenTypeIds)) {

            Map<String, OnnxTensor> inputs = new HashMap<>();
            for (String name : session.getInputNames()) {
                if (name.contains("input_ids")) {
                    inputs.put(name, idsTensor);
                } else if (name.contains("attention_mask")) {
                    inputs.put(name, maskTensor);
                } else if (name.contains("token_type_ids")) {
                    inputs.put(name, typeTensor);
                }
            }
            try (OrtSession.Result result = session.run(inputs)) {
                OnnxTensor out = (OnnxTensor) result.iterator().next().getValue();
                float[][][] hidden = (float[][][]) out.getValue();
                List<float[]> embeddings = new ArrayList<>(batch);
                for (int b = 0; b < batch; b++) {
                    embeddings.add(l2Normalize(clsVector(hidden[b])));
                }
                return embeddings;
            }
        } catch (OrtException e) {
            throw new IllegalStateException("ONNX embedding inference failed: " + e.getMessage(), e);
        }
    }

    /** 单条编码 → L2 归一化向量（1024 维）。 */
    public float[] encode(String text) {
        return encode(List.of(text)).get(0);
    }

    // ---- tokenizer（BERT Chinese：lowercase + CJK 逐字 + WordPiece）----

    /** 整句 → [CLS] ids [SEP]，按 MAX_SEQ_LEN-2 截断。 */
    List<Integer> tokenize(String text) {
        List<String> pieces = basicTokenize(text);
        List<Integer> ids = new ArrayList<>(pieces.size() + 2);
        ids.add(clsId);
        int budget = MAX_SEQ_LEN - 2;
        for (String piece : pieces) {
            if (ids.size() - 1 >= budget) {
                break;
            }
            ids.addAll(wordpiece(piece));
        }
        ids.add(sepId);
        return ids;
    }

    /** BasicTokenizer：NFKC → lowercase → CJK 逐字加空格 → 标点独立成 token → 空白切分。 */
    List<String> basicTokenize(String text) {
        String normalized = java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFKC);
        StringBuilder sb = new StringBuilder(normalized.length());
        for (int i = 0; i < normalized.length(); i++) {
            char c = normalized.charAt(i);
            if (c == '\t' || c == '\n' || c == '\r' || Character.isISOControl(c)) {
                sb.append(' ');
                continue;
            }
            if (isCjk(c) || isPunctuation(c)) {
                // CJK/标点各自独立：两侧加空格，空白切分后自然成单独 piece
                sb.append(' ').append(c).append(' ');
            } else {
                sb.append(Character.toLowerCase(c));
            }
        }
        List<String> out = new ArrayList<>();
        for (String p : sb.toString().split("\\s+")) {
            if (!p.isEmpty()) {
                out.add(p);
            }
        }
        return out;
    }

    /** WordPiece 最长匹配；查不到 → [UNK]；超长 piece → [UNK]。 */
    private List<Integer> wordpiece(String piece) {
        if (piece.length() > MAX_INPUT_CHARS_PER_WORD) {
            return List.of(unkId);
        }
        List<Integer> out = new ArrayList<>();
        int start = 0;
        boolean bad = false;
        while (start < piece.length()) {
            int end = piece.length();
            Integer found = null;
            while (start < end) {
                String sub = piece.substring(start, end);
                if (start > 0) {
                    sub = "##" + sub;
                }
                Integer id = vocab.get(sub);
                if (id != null) {
                    found = id;
                    break;
                }
                end--;
            }
            if (found == null) {
                bad = true;
                break;
            }
            out.add(found);
            start = end;
        }
        return bad ? List.of(unkId) : out;
    }

    /** BERT Chinese CJK 区间（含扩展 A 与兼容表意文字）。 */
    private static boolean isCjk(char c) {
        return (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF)
                || (c >= 0xF900 && c <= 0xFAFF);
    }

    /** 标点（ASCII 标点 + CJK 符号/全角形式），独立成 token。 */
    private static boolean isPunctuation(char c) {
        if ((c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126)) {
            return true;
        }
        return c >= 0x3000 && c <= 0x303F || c >= 0xFF00 && c <= 0xFFEF;
    }

    /** CLS 池化：取该 batch 首 token（[CLS]）整段隐层向量（hidden[b] 形状 [seq][dim]，取 [0]）。 */
    private static float[] clsVector(float[][] seqHidden) {
        return seqHidden[0];
    }

    /** L2 归一化（零向量原样返回，防除零）。 */
    static float[] l2Normalize(float[] v) {
        double sq = 0;
        for (float x : v) {
            sq += x * x;
        }
        double norm = Math.sqrt(sq);
        if (norm < 1e-9) {
            return v;
        }
        float[] out = new float[v.length];
        for (int i = 0; i < v.length; i++) {
            out[i] = (float) (v[i] / norm);
        }
        return out;
    }

    private int id(String token) {
        Integer id = vocab.get(token);
        if (id == null) {
            throw new IllegalStateException("vocab missing special token: " + token);
        }
        return id;
    }

    private static Map<String, Integer> loadVocab(Path vocabFile) throws IOException {
        Map<String, Integer> vocab = new HashMap<>(32768);
        List<String> lines = Files.readAllLines(vocabFile, java.nio.charset.StandardCharsets.UTF_8);
        for (int i = 0; i < lines.size(); i++) {
            vocab.put(lines.get(i).trim(), i);
        }
        return vocab;
    }
}
