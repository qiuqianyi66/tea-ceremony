package com.tea.culture.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

/**
 * culture_chunks 回填管线（PLAN-ai-capability T04/T05；ADR-013 向量化落地）。
 * 职责：读八张文化表（teas/tea_people/tea_regions/tea_poems/teawares/tea_etiquettes/tea_relations/tea_processes）
 * 逐行生成结构化 chunk_text → 调 DashScope text-embedding-v3（1024 维，对齐 V3 表 embedding vector(1024)）
 * → upsert 到 culture_chunks（status='ready'）。
 * 承重墙：EmbeddingModel 不可用（AI key disabled）或嵌入失败 → 仅落 chunk_text，status='pending'（T04 可无 key 验证；
 * T05 需 key 后重跑即补嵌）。表可清空重填（PLAN Rollback：无外部依赖，成本=重跑嵌入费用）。
 * 幂等：uk_culture_chunks_source 唯一约束 + ON CONFLICT DO UPDATE（重复执行不产生重复行）。
 */
@Slf4j
@Service
public class ChunkBackfillService {

    /** 每批嵌入条数：text-embedding-v3 batch 上限 10（官方文档）；超出由本服务分批。 */
    private static final int EMBED_BATCH = 10;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectProvider<EmbeddingModel> embeddingModelProvider;

    public ChunkBackfillService(JdbcTemplate jdbcTemplate, ObjectProvider<EmbeddingModel> embeddingModelProvider) {
        this.jdbcTemplate = jdbcTemplate;
        this.embeddingModelProvider = embeddingModelProvider;
    }

    /** 一条待回填 chunk（source_type/source_id 对应 uk_culture_chunks_source）。 */
    public record ChunkDraft(String sourceType, int sourceId, String chunkText, String sourceName, String category) {
    }

    /** 回填结果统计。 */
    public record BackfillResult(Map<String, Integer> perType, int total, int embedded, int pending,
                                 String embedStatus) {
    }

    /**
     * 执行回填。embed=false 只落 chunk_text（status=pending，不调 API）；embed=true 尝试嵌入。
     * 嵌入失败自动降级 pending（单批失败不影响已成功批次）。
     */
    public BackfillResult backfill(boolean embed) {
        List<ChunkDraft> drafts = collectDrafts();
        EmbeddingModel embeddingModel = embed ? embeddingModelProvider.getIfAvailable() : null;
        // embedStatus 由结果反推（bean 存在 ≠ 嵌入成功：dashscope starter 在 key disabled 时 bean 仍存在）
        String embedStatus;
        if (!embed) {
            embedStatus = "skipped（embed=false）";
        } else if (embeddingModel == null) {
            embedStatus = "unavailable（EmbeddingModel 未配置）";
        } else {
            embedStatus = "ready";
        }

        int embedded = 0;
        int pending = 0;
        for (int i = 0; i < drafts.size(); i += EMBED_BATCH) {
            List<ChunkDraft> batch = drafts.subList(i, Math.min(i + EMBED_BATCH, drafts.size()));
            List<float[]> vectors = null;
            if (embeddingModel != null) {
                try {
                    vectors = embeddingModel.embed(batch.stream().map(ChunkDraft::chunkText).toList());
                } catch (Exception e) {
                    log.warn("embedding batch failed ({} rows downgraded to pending): {}", batch.size(), e.getMessage());
                    vectors = null;
                }
            }
            for (int j = 0; j < batch.size(); j++) {
                ChunkDraft d = batch.get(j);
                float[] v = vectors == null ? null : vectors.get(j);
                // 降级也要落库（status=pending，可补嵌）；计数语义：embedded=「有向量且落库成功」
                boolean ok = upsert(d, v);
                if (v != null && ok) {
                    embedded++;
                } else {
                    pending++;
                }
            }
        }
        log.info("culture_chunks backfill done: total={} embedded={} pending={} status={}",
                drafts.size(), embedded, pending, embedStatus);

        // 结果反推 embedStatus：嵌入批次全部失败 → degraded（真实库行为：bean 存在但调用失败/返回空）
        if (embed && embeddingModel != null) {
            if (pending > 0 && embedded == 0) {
                embedStatus = "degraded（嵌入失败，全部落 pending）";
            } else if (pending > 0) {
                embedStatus = "partial（部分嵌入失败，pending=" + pending + "）";
            }
        }

        Map<String, Integer> perType = new LinkedHashMap<>();
        drafts.forEach(d -> perType.merge(d.sourceType(), 1, Integer::sum));
        return new BackfillResult(perType, drafts.size(), embedded, pending, embedStatus);
    }

    /** 八表逐行生成 ChunkDraft（JdbcTemplate 只读；JSONB 字段取 ::text 原文）。 */
    private List<ChunkDraft> collectDrafts() {
        List<ChunkDraft> out = new ArrayList<>();

        jdbcTemplate.query("SELECT id, name, category, origin, flavor::text, story, description FROM teas ORDER BY id",
                (RowCallbackHandler) rs -> {
                    String flavor = rs.getString("flavor");
                    out.add(new ChunkDraft("tea", rs.getInt("id"), String.format(
                            "【茶】%s（%s，产自%s）。风味：%s。%s %s",
                            str(rs.getString("name")), str(rs.getString("category")), str(rs.getString("origin")),
                            cleanJson(flavor), str(rs.getString("story")), str(rs.getString("description"))),
                            rs.getString("name"), rs.getString("category")));
                });

        jdbcTemplate.query("SELECT id, name, dynasty, title, description, contribution, quote FROM tea_people ORDER BY id",
                (RowCallbackHandler) rs -> out.add(new ChunkDraft("person", rs.getInt("id"), String.format(
                        "【人物】%s（%s，%s）。简介：%s。贡献：%s。名言：%s",
                        str(rs.getString("name")), str(rs.getString("dynasty")), str(rs.getString("title")),
                        str(rs.getString("description")), str(rs.getString("contribution")), str(rs.getString("quote"))),
                        rs.getString("name"), rs.getString("dynasty"))));

        jdbcTemplate.query("SELECT id, name, province, climate, famous_for::text, description FROM tea_regions ORDER BY id",
                (RowCallbackHandler) rs -> {
                    String famous = cleanJson(rs.getString("famous_for"));
                    out.add(new ChunkDraft("region", rs.getInt("id"), String.format(
                            "【产区】%s（%s）。气候：%s。名茶：%s。%s",
                            str(rs.getString("name")), str(rs.getString("province")), str(rs.getString("climate")),
                            famous, str(rs.getString("description"))),
                            rs.getString("name"), rs.getString("province")));
                });

        jdbcTemplate.query("SELECT id, title, author, dynasty, content, description FROM tea_poems ORDER BY id",
                (RowCallbackHandler) rs -> out.add(new ChunkDraft("poem", rs.getInt("id"), String.format(
                        "【茶诗】《%s》（%s，%s）。%s 赏析：%s",
                        str(rs.getString("title")), str(rs.getString("author")), str(rs.getString("dynasty")),
                        str(rs.getString("content")), str(rs.getString("description"))),
                        rs.getString("title"), rs.getString("author"))));

        jdbcTemplate.query("SELECT id, name, ware_type, material, description, culture_story FROM teawares ORDER BY id",
                (RowCallbackHandler) rs -> out.add(new ChunkDraft("teaware", rs.getInt("id"), String.format(
                        "【茶器】%s（%s，%s）。%s 文化：%s",
                        str(rs.getString("name")), str(rs.getString("ware_type")), str(rs.getString("material")),
                        str(rs.getString("description")), str(rs.getString("culture_story"))),
                        rs.getString("name"), rs.getString("ware_type"))));

        jdbcTemplate.query("SELECT id, name, occasion, description, steps::text FROM tea_etiquettes ORDER BY id",
                (RowCallbackHandler) rs -> out.add(new ChunkDraft("etiquette", rs.getInt("id"), String.format(
                        "【茶礼】%s（%s）。%s 步骤：%s",
                        str(rs.getString("name")), str(rs.getString("occasion")),
                        str(rs.getString("description")), cleanJson(rs.getString("steps"))),
                        rs.getString("name"), rs.getString("occasion"))));

        // relations 源/目标名字按类型 LEFT JOIN 各 name 表（T06 回填后非空；未命中时名字为 null 不阻塞）
        jdbcTemplate.query("""
                        SELECT r.id, r.relation, r.source_type, r.target_type,
                               COALESCE(ts.name, tp.name, tr.name, tpo.title, tw.name, te.name, tpr.name) AS source_name,
                               COALESCE(ts2.name, tp2.name, tr2.name, tpo2.title, tw2.name, te2.name, tpr2.name) AS target_name
                        FROM tea_relations r
                        LEFT JOIN teas ts       ON r.source_type = 'tea'      AND ts.id = r.source_id
                        LEFT JOIN tea_people tp ON r.source_type = 'person'   AND tp.id = r.source_id
                        LEFT JOIN tea_regions tr ON r.source_type = 'region'  AND tr.id = r.source_id
                        LEFT JOIN tea_poems tpo ON r.source_type = 'poem'     AND tpo.id = r.source_id
                        LEFT JOIN teawares tw   ON r.source_type = 'teaware'  AND tw.id = r.source_id
                        LEFT JOIN tea_etiquettes te ON r.source_type = 'etiquette' AND te.id = r.source_id
                        LEFT JOIN tea_processes tpr ON r.source_type = 'process'  AND tpr.id = r.source_id
                        LEFT JOIN teas ts2       ON r.target_type = 'tea'      AND ts2.id = r.target_id
                        LEFT JOIN tea_people tp2 ON r.target_type = 'person'   AND tp2.id = r.target_id
                        LEFT JOIN tea_regions tr2 ON r.target_type = 'region'  AND tr2.id = r.target_id
                        LEFT JOIN tea_poems tpo2 ON r.target_type = 'poem'     AND tpo2.id = r.target_id
                        LEFT JOIN teawares tw2   ON r.target_type = 'teaware'  AND tw2.id = r.target_id
                        LEFT JOIN tea_etiquettes te2 ON r.target_type = 'etiquette' AND te2.id = r.target_id
                        LEFT JOIN tea_processes tpr2 ON r.target_type = 'process'  AND tpr2.id = r.target_id
                        ORDER BY r.id
                        """,
                (RowCallbackHandler) rs -> out.add(new ChunkDraft("relation", rs.getInt("id"), String.format(
                        "【关系】%s：%s（%s）→ %s（%s）",
                        str(rs.getString("relation")), str(rs.getString("source_name")), str(rs.getString("source_type")),
                        str(rs.getString("target_name")), str(rs.getString("target_type"))),
                        rs.getString("source_name"), rs.getString("relation"))));

        jdbcTemplate.query("SELECT id, name, tea_category, summary, steps::text FROM tea_processes ORDER BY id",
                (RowCallbackHandler) rs -> out.add(new ChunkDraft("process", rs.getInt("id"), String.format(
                        "【工艺】%s（%s）。%s 步骤：%s",
                        str(rs.getString("name")), str(rs.getString("tea_category")),
                        str(rs.getString("summary")), cleanJson(rs.getString("steps"))),
                        rs.getString("name"), rs.getString("tea_category"))));

        return out;
    }

    /** upsert 一条 chunk；embedding 为 null 时落 pending。返回 true=成功（含 pending 落库），false=失败。 */
    private boolean upsert(ChunkDraft d, float[] vector) {
        String status = vector == null ? "pending" : "ready";
        try {
            int rows = jdbcTemplate.update("""
                            INSERT INTO culture_chunks (source_type, source_id, chunk_text, metadata, embedding, status)
                            VALUES (?, ?, ?, ?::jsonb, ?::vector, ?)
                            ON CONFLICT (source_type, source_id) DO UPDATE
                            SET chunk_text = EXCLUDED.chunk_text, metadata = EXCLUDED.metadata,
                                embedding = EXCLUDED.embedding, status = EXCLUDED.status, updated_at = now()
                            """,
                    d.sourceType(), d.sourceId(), d.chunkText(),
                    "{\"sourceName\":\"" + safeJson(d.sourceName()) + "\",\"category\":\"" + safeJson(d.category()) + "\"}",
                    vector == null ? null : vectorToPg(vector),
                    status);
            return rows > 0;
        } catch (Exception e) {
            log.warn("upsert chunk failed ({} id={}): {}", d.sourceType(), d.sourceId(), e.getMessage());
            return false;
        }
    }

    /** float[] → pgvector 字面量 '[0.1,0.2,...]'（1024 维对齐 text-embedding-v3）。 */
    private String vectorToPg(float[] v) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(v[i]);
        }
        return sb.append(']').toString();
    }

    /** JSONB 数组/对象文本 → 纯文本（去方括号引号），保证 chunk 可读性。 */
    private String cleanJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        return raw.replaceAll("[\\[\\]\"{}]", " ").replaceAll("\\s+", " ").trim();
    }

    private String str(String s) {
        return s == null ? "" : s;
    }

    /** metadata JSON 值转义（防注入 JSON 结构）。 */
    private String safeJson(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
