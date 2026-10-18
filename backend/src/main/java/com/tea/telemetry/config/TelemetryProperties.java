package com.tea.telemetry.config;

import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 遥测模块配置（application.yml telemetry.*）。
 * SLO 目标/权重是前后端共享常量（契约 §6），必须配置化而不是写死在 Service 里：
 * 目标值调整时前端契约同步改 yml，不必改代码、不必重新审查评分逻辑。
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "telemetry")
public class TelemetryProperties {

    /** raw 事件保留天数（契约 §10：7 天；指纹与快照永久保留）。 */
    private int retentionDays = 7;

    /** 单请求事件条数上限（契约 §1：超出即整体 400，防匿名端点被大包打爆）。 */
    private int maxEventsPerRequest = 50;

    /** SLO 评估回看小时数（GET /slo 的滚动窗口；快照任务固定 15 分钟窗口）。 */
    private int sloWindowHours = 24;

    /** 五项 Web Vitals 的目标与权重，默认值即契约 §6 常量。 */
    private Metric lcp = new Metric("LCP", 2500, 25);
    private Metric inp = new Metric("INP", 200, 25);
    private Metric cls = new Metric("CLS", 0.1, 20);
    private Metric fcp = new Metric("FCP", 1800, 15);
    private Metric ttfb = new Metric("TTFB", 800, 15);

    /** 评估顺序固定为契约表顺序，报告逐行输出不依赖 HashMap 遍历顺序。 */
    public List<Metric> metricSpecs() {
        return List.of(lcp, inp, cls, fcp, ttfb);
    }

    /** 按指标名查目标（vital 事件只收这五个名字，其余计入 rejected）。 */
    public Metric metric(String name) {
        for (Metric metric : metricSpecs()) {
            if (metric.getName().equals(name)) {
                return metric;
            }
        }
        return null;
    }

    /** 单指标配置：name 参与快照与报告，target/weight 可被 yml 覆盖。 */
    @Getter
    public static class Metric {

        private final String name;

        @Setter
        private double target;

        @Setter
        private int weight;

        public Metric(String name, double target, int weight) {
            this.name = name;
            this.target = target;
            this.weight = weight;
        }
    }
}
