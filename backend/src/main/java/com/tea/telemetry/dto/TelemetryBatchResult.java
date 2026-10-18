package com.tea.telemetry.dto;

/**
 * 批量上报结果（契约 §4）：accepted 新入库 / duplicated 幂等命中 / rejected 校验失败。
 */
public record TelemetryBatchResult(int accepted, int duplicated, int rejected) {
}
