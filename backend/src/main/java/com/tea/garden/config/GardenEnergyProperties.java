package com.tea.garden.config;

import java.util.LinkedHashMap;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 茶园能量配置（application.yml garden.energy.*）。
 * 能量规则：每次冲泡基础能量 + 笔记每 100 字能量；阶段阈值只升不降推进（D2/D4 已确认）。
 */
@Getter
@Component
public class GardenEnergyProperties {

    private final int brewBase;
    private final int notePer100;
    /** 阶段阈值，按升序插入（planted → harvested）。 */
    private final LinkedHashMap<String, Integer> phases;

    public GardenEnergyProperties(
            @Value("${garden.energy.rules.brew-base:5}") int brewBase,
            @Value("${garden.energy.rules.note-per-100:10}") int notePer100,
            @Value("${garden.energy.phases.planted:0}") int planted,
            @Value("${garden.energy.phases.growing:100}") int growing,
            @Value("${garden.energy.phases.blooming:300}") int blooming,
            @Value("${garden.energy.phases.harvested:600}") int harvested) {
        this.brewBase = brewBase;
        this.notePer100 = notePer100;
        this.phases = new LinkedHashMap<>();
        this.phases.put("planted", planted);
        this.phases.put("growing", growing);
        this.phases.put("blooming", blooming);
        this.phases.put("harvested", harvested);
    }

    /** 给定累计能量 → 最高可达阶段（阈值 ≤ 能量）。 */
    public String phaseFor(int energy) {
        String phase = "planted";
        for (var entry : phases.entrySet()) {
            if (energy >= entry.getValue()) {
                phase = entry.getKey();
            }
        }
        return phase;
    }

    /** 阶段序号（planted=0 … harvested=3），用于"只升不降"判断；未知阶段视为最低。 */
    public int rank(String phase) {
        int i = 0;
        for (String key : phases.keySet()) {
            if (key.equals(phase)) {
                return i;
            }
            i++;
        }
        return -1;
    }
}
