package com.tea.garden.service;

import com.tea.common.exception.ConflictException;
import com.tea.garden.config.GardenEnergyProperties;
import com.tea.garden.entity.GardenEnergyEvent;
import com.tea.garden.entity.GardenPlant;
import com.tea.garden.repository.GardenEnergyEventRepository;
import com.tea.garden.repository.GardenPlantRepository;
import com.tea.garden.vo.GardenEnergySummaryVo;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 茶园能量域（ADR-015）：事件账本 append-only + 收集时聚合。
 * recordTasting 由 TastingRecordService.create 同事务调用（client_id 复用品鉴记录，天然防重）；
 * collect 单事务原子：置 collected_at + 累加 plants.energy + 阶段推进（只升不降）。
 */
@Service
@RequiredArgsConstructor
public class GardenEnergyService {

    private static final String SOURCE_TASTING = "tasting";
    /** 无植物时的能量承载行固定 client_id（S1 单植物模型防御场景）。 */
    private static final String AUTO_PLANT_CLIENT_ID = "auto-plant";

    private final GardenEnergyEventRepository eventRepository;
    private final GardenPlantRepository plantRepository;
    private final GardenEnergyProperties props;

    /**
     * 品鉴落库同事务记账（幂等）：同 user_id + client_id 已记账则忽略。
     * amount = brew-base + floor(len(notes)/100) * note-per-100（D1 单事件模型）。
     */
    @Transactional
    public void recordTasting(Integer userId, String clientId, String notes) {
        if (eventRepository.findByUserIdAndClientId(userId, clientId).isPresent()) {
            return;
        }
        int amount = props.getBrewBase()
                + (notes == null ? 0 : notes.length() / 100) * props.getNotePer100();
        GardenEnergyEvent event = new GardenEnergyEvent();
        event.setUserId(userId);
        event.setClientId(clientId);
        event.setAmount(amount);
        event.setSource(SOURCE_TASTING);
        try {
            eventRepository.save(event);
        } catch (DataIntegrityViolationException ex) {
            // 并发同 client_id 记账：唯一索引兜底，已记账则忽略（幂等，对照 record 域）
        }
    }

    @Transactional(readOnly = true)
    public GardenEnergySummaryVo summary(Integer userId) {
        int pendingAmount = eventRepository.findByUserIdAndCollectedAtIsNull(userId).stream()
                .mapToInt(GardenEnergyEvent::getAmount).sum();
        int collectedAmount = eventRepository.findByUserIdAndCollectedAtIsNotNull(userId).stream()
                .mapToInt(GardenEnergyEvent::getAmount).sum();
        int totalEnergy = plantRepository.findByUserIdOrderByIdAsc(userId).stream()
                .mapToInt(GardenPlant::getEnergy).sum();
        return new GardenEnergySummaryVo(
                pendingAmount, collectedAmount, totalEnergy,
                props.phaseFor(totalEnergy), props.getPhases());
    }

    /**
     * 一键收集：把未收事件置为已收，金额累加到植物 energy，按阈值推进阶段（只升不降）。单事务原子。
     * 无植物时自动创建默认承载行（client_id=auto-plant），能量不丢，仍可推进（PLAN §6.3）。
     */
    @Transactional
    public GardenEnergySummaryVo collect(Integer userId) {
        List<GardenEnergyEvent> pending = eventRepository.findByUserIdAndCollectedAtIsNull(userId);
        int pendingAmount = pending.stream().mapToInt(GardenEnergyEvent::getAmount).sum();
        if (pendingAmount > 0) {
            LocalDateTime now = LocalDateTime.now();
            for (GardenEnergyEvent event : pending) {
                event.setCollectedAt(now);
            }
            eventRepository.saveAll(pending);
            GardenPlant plant = ensureCarrierPlant(userId);
            int newEnergy = plant.getEnergy() + pendingAmount;
            plant.setEnergy(newEnergy);
            String targetPhase = props.phaseFor(newEnergy);
            if (props.rank(targetPhase) > props.rank(plant.getStatus())) {
                plant.setStatus(targetPhase);
            }
            plantRepository.save(plant);
        }
        return summary(userId);
    }

    private GardenPlant ensureCarrierPlant(Integer userId) {
        return plantRepository.findByUserIdOrderByIdAsc(userId).stream().findFirst().orElseGet(() -> {
            GardenPlant plant = new GardenPlant();
            plant.setUserId(userId);
            plant.setClientId(AUTO_PLANT_CLIENT_ID);
            plant.setPlantType("tea");
            plant.setStatus("planted");
            plant.setEnergy(0);
            try {
                return plantRepository.save(plant);
            } catch (DataIntegrityViolationException ex) {
                // 并发创建承载行：唯一索引兜底，回查已存在行
                return plantRepository.findByUserIdAndClientId(userId, AUTO_PLANT_CLIENT_ID)
                        .orElseThrow(() -> new ConflictException("默认植物创建冲突，请重试"));
            }
        });
    }
}
