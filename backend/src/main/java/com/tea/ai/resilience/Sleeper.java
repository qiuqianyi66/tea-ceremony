package com.tea.ai.resilience;

/**
 * 退避等待抽象。
 * 为什么要接口：重试测试必须跳过真实等待（3 次重试 = 2.4s 起步），
 * 注入记录型实现即可断言退避序列，且不把测试时长绑到配置值上。
 */
@FunctionalInterface
public interface Sleeper {

    void sleep(long millis) throws InterruptedException;
}
