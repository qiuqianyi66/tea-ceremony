package com.tea.ai.experiment.dto;

import jakarta.validation.constraints.Size;

/**
 * 停止实验请求体（可选）：reason 落 stop_reason 列，便于事后解释「为什么停」。
 * 空/缺省由服务层补默认原因，不在这里强制必填——人工紧急止血时不该先被表单拦住。
 */
public record StopExperimentRequest(@Size(max = 256, message = "停止原因不超过 256 字") String reason) {
}
