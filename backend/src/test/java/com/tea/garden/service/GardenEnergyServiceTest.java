package com.tea.garden.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.garden.config.GardenEnergyProperties;
import com.tea.garden.entity.GardenEnergyEvent;
import com.tea.garden.entity.GardenPlant;
import com.tea.garden.repository.GardenEnergyEventRepository;
import com.tea.garden.repository.GardenPlantRepository;
import com.tea.garden.vo.GardenEnergySummaryVo;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class GardenEnergyServiceTest {

    @Mock
    private GardenEnergyEventRepository eventRepository;

    @Mock
    private GardenPlantRepository plantRepository;

    private GardenEnergyService service;

    private final GardenEnergyProperties props = new GardenEnergyProperties(5, 10, 0, 100, 300, 600);

    @BeforeEach
    void setUp() {
        service = new GardenEnergyService(eventRepository, plantRepository, props);
    }

    private GardenEnergyEvent event(int amount, boolean collected) {
        GardenEnergyEvent e = new GardenEnergyEvent();
        e.setAmount(amount);
        e.setSource("tasting");
        if (collected) {
            e.setCollectedAt(LocalDateTime.now());
        }
        return e;
    }

    private GardenPlant plant(int energy, String status) {
        GardenPlant p = new GardenPlant();
        p.setId(1);
        p.setUserId(1);
        p.setClientId("c1");
        p.setStatus(status);
        p.setEnergy(energy);
        return p;
    }

    // ---- recordTasting：幂等记账 ----

    @Test
    void recordTastingComputesAmountFromNotes() {
        when(eventRepository.findByUserIdAndClientId(1, "c1")).thenReturn(Optional.empty());

        service.recordTasting(1, "c1", "一二三四五六七八九十".repeat(25)); // 250 字

        ArgumentCaptor<GardenEnergyEvent> captor = ArgumentCaptor.forClass(GardenEnergyEvent.class);
        verify(eventRepository).save(captor.capture());
        GardenEnergyEvent saved = captor.getValue();
        assertThat(saved.getAmount()).isEqualTo(25); // 5 + 250/100*10
        assertThat(saved.getSource()).isEqualTo("tasting");
        assertThat(saved.getCollectedAt()).isNull();
    }

    @Test
    void recordTastingNullNotesGivesBaseAmount() {
        when(eventRepository.findByUserIdAndClientId(1, "c1")).thenReturn(Optional.empty());

        service.recordTasting(1, "c1", null);

        ArgumentCaptor<GardenEnergyEvent> captor = ArgumentCaptor.forClass(GardenEnergyEvent.class);
        verify(eventRepository).save(captor.capture());
        assertThat(captor.getValue().getAmount()).isEqualTo(5);
    }

    @Test
    void recordTastingIdempotentSkipsExisting() {
        when(eventRepository.findByUserIdAndClientId(1, "c1")).thenReturn(Optional.of(event(5, false)));

        service.recordTasting(1, "c1", "好茶");

        verify(eventRepository, never()).save(any());
    }

    @Test
    void recordTastingConcurrentViolationIgnored() {
        when(eventRepository.findByUserIdAndClientId(1, "c1")).thenReturn(Optional.empty());
        when(eventRepository.save(any(GardenEnergyEvent.class)))
                .thenThrow(new DataIntegrityViolationException("dup"));

        service.recordTasting(1, "c1", "好茶"); // 不抛出，幂等忽略
    }

    // ---- collect：原子收集 + 阶段推进 ----

    @Test
    void collectAccumulatesPendingAndAdvancesPhase() {
        when(eventRepository.findByUserIdAndCollectedAtIsNull(1))
                .thenReturn(List.of(event(80, false), event(50, false)));
        when(plantRepository.findByUserIdOrderByIdAsc(1))
                .thenReturn(List.of(plant(0, "planted")));
        // summary() 走 DB 侧聚合：收集后未收 0、已收 130、总能量 130
        when(eventRepository.sumPendingAmount(1)).thenReturn(0);
        when(eventRepository.sumCollectedAmount(1)).thenReturn(130);
        when(plantRepository.sumEnergy(1)).thenReturn(130);

        GardenEnergySummaryVo vo = service.collect(1);

        ArgumentCaptor<GardenPlant> plantCaptor = ArgumentCaptor.forClass(GardenPlant.class);
        verify(plantRepository).save(plantCaptor.capture());
        assertThat(plantCaptor.getValue().getEnergy()).isEqualTo(130);
        assertThat(plantCaptor.getValue().getStatus()).isEqualTo("growing"); // 130 ≥ 100
        ArgumentCaptor<List<GardenEnergyEvent>> eventsCaptor = ArgumentCaptor.forClass(List.class);
        verify(eventRepository).saveAll(eventsCaptor.capture());
        assertThat(eventsCaptor.getValue()).allMatch(e -> e.getCollectedAt() != null);
        assertThat(vo.pending_amount()).isEqualTo(0);
        assertThat(vo.collected_amount()).isEqualTo(130);
        assertThat(vo.total_energy()).isEqualTo(130);
        assertThat(vo.phase()).isEqualTo("growing");
    }

    @Test
    void collectNeverDowngradesPhase() {
        when(eventRepository.findByUserIdAndCollectedAtIsNull(1)).thenReturn(List.of(event(50, false)));
        when(plantRepository.findByUserIdOrderByIdAsc(1)).thenReturn(List.of(plant(350, "blooming")));
        when(eventRepository.sumPendingAmount(1)).thenReturn(0);
        when(eventRepository.sumCollectedAmount(1)).thenReturn(0);
        when(plantRepository.sumEnergy(1)).thenReturn(400);

        service.collect(1);

        ArgumentCaptor<GardenPlant> captor = ArgumentCaptor.forClass(GardenPlant.class);
        verify(plantRepository).save(captor.capture());
        assertThat(captor.getValue().getEnergy()).isEqualTo(400);
        assertThat(captor.getValue().getStatus()).isEqualTo("blooming"); // 400 < 600，不升也不降
    }

    @Test
    void collectCreatesDefaultCarrierPlantWhenNone() {
        when(eventRepository.findByUserIdAndCollectedAtIsNull(1)).thenReturn(List.of(event(30, false)));
        when(plantRepository.findByUserIdOrderByIdAsc(1)).thenReturn(List.of(), List.of(plant(30, "planted")));
        when(plantRepository.save(any(GardenPlant.class))).thenAnswer(inv -> inv.getArgument(0));
        when(eventRepository.sumPendingAmount(1)).thenReturn(0);
        when(eventRepository.sumCollectedAmount(1)).thenReturn(30);
        when(plantRepository.sumEnergy(1)).thenReturn(30);

        service.collect(1);

        ArgumentCaptor<GardenPlant> captor = ArgumentCaptor.forClass(GardenPlant.class);
        verify(plantRepository, times(2)).save(captor.capture());
        GardenPlant created = captor.getAllValues().get(0); // 第一次 save = 承载行创建
        assertThat(created.getClientId()).isEqualTo("auto-plant");
        assertThat(created.getEnergy()).isEqualTo(30);
        assertThat(created.getStatus()).isEqualTo("planted");
    }

    @Test
    void collectWithNothingPendingKeepsState() {
        when(eventRepository.findByUserIdAndCollectedAtIsNull(1)).thenReturn(List.of());
        when(eventRepository.sumPendingAmount(1)).thenReturn(0);
        when(eventRepository.sumCollectedAmount(1)).thenReturn(0);
        when(plantRepository.sumEnergy(1)).thenReturn(100);

        GardenEnergySummaryVo vo = service.collect(1);

        verify(plantRepository, never()).save(any());
        assertThat(vo.pending_amount()).isZero();
        assertThat(vo.total_energy()).isEqualTo(100);
        assertThat(vo.phase()).isEqualTo("growing");
    }

    // ---- summary：DB 侧聚合 ----

    @Test
    void summaryAggregatesPendingCollectedAndPhase() {
        when(eventRepository.sumPendingAmount(1)).thenReturn(50);
        when(eventRepository.sumCollectedAmount(1)).thenReturn(10);
        when(plantRepository.sumEnergy(1)).thenReturn(100);

        GardenEnergySummaryVo vo = service.summary(1);

        assertThat(vo.pending_amount()).isEqualTo(50);
        assertThat(vo.collected_amount()).isEqualTo(10);
        assertThat(vo.total_energy()).isEqualTo(100);
        assertThat(vo.phase()).isEqualTo("growing");
        assertThat(vo.phase_thresholds()).containsEntry("planted", 0)
                .containsEntry("growing", 100)
                .containsEntry("blooming", 300)
                .containsEntry("harvested", 600);
        // summary 不再拉全表行：列表加载方法零调用
        verify(eventRepository, never()).findByUserIdAndCollectedAtIsNull(any());
        verify(eventRepository, never()).findByUserIdAndCollectedAtIsNotNull(any());
        verify(plantRepository, never()).findByUserIdOrderByIdAsc(any());
    }
}
