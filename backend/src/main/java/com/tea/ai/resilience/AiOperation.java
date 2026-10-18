package com.tea.ai.resilience;

/**
 * 一次 AI 上游调用（可抛受检异常）。
 * 为什么声明 throws Exception：Spring AI 的调用链可能抛受检 I/O 异常；
 * 若这里只允许 RuntimeException，调用方就得自己包一层 try/catch，容错逻辑重新散落回业务代码。
 */
@FunctionalInterface
public interface AiOperation<T> {

    T run() throws Exception;
}
