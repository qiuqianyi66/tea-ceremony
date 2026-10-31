package com.tea.ai.tool;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 多工具门面（P2.2：进程内 function calling）。
 *
 * <p>职责一件：按请求用户组装出本次 ChatClient 要挂载的工具实例数组。
 * 4 个工具 = ①culture_query（复用既有 CultureQueryTools 单例）②brew_params
 * ③my_tasting_records ④brew_advice。后两个必须按 userId 绑定（身份由服务端传入，
 * 模型参数碰不到），所以不能直接挂单例——每请求调 {@link #toolsFor(Integer)} 现绑。</p>
 *
 * <p>为什么是门面而不是 AiChatService 里直接拼：AiChatService 只依赖一个 bean，
 * 工具集合的增删只改本类；与既有 CultureQueryTools.collectingInto 同纪律——
 * 绑定实例不依赖框架 ToolContext 透传，最坏结果是来源/历史为空，不会整条工具链失效。</p>
 */
@Slf4j
@Component
public class MultiToolAgent {

    private final CultureQueryTools cultureQueryTools;
    private final BrewParamTools brewParamTools;
    private final TastingRecordTools tastingRecordTools;
    private final BrewAdviceTools brewAdviceTools;

    public MultiToolAgent(CultureQueryTools cultureQueryTools,
                          BrewParamTools brewParamTools,
                          TastingRecordTools tastingRecordTools,
                          BrewAdviceTools brewAdviceTools) {
        this.cultureQueryTools = cultureQueryTools;
        this.brewParamTools = brewParamTools;
        this.tastingRecordTools = tastingRecordTools;
        this.brewAdviceTools = brewAdviceTools;
    }

    /**
     * 组装本次请求的工具数组（按 userId 绑定需要身份的工具）。
     *
     * @param userId 当前请求登录用户；null（访客）→ 记录类工具绑定 null，模型调用时返回登录提示
     * @return 交给 {@code ChatClient.prompt().tools(...)} 的工具实例数组
     */
    public Object[] toolsFor(Integer userId) {
        return new Object[]{
                cultureQueryTools,
                brewParamTools,
                tastingRecordTools.boundTo(userId),
                brewAdviceTools.boundTo(userId)
        };
    }
}
