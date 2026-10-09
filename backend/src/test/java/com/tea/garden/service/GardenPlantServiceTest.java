package com.tea.garden.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.garden.dto.GardenPlantCreateRequest;
import com.tea.garden.entity.GardenPlant;
import com.tea.garden.repository.GardenPlantRepository;
import com.tea.garden.vo.GardenPlantVo;
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
class GardenPlantServiceTest {

    @Mock
    private GardenPlantRepository plantRepository;

    private GardenPlantService service;

    @BeforeEach
    void setUp() {
        service = new GardenPlantService(plantRepository);
    }

    private GardenPlant plant(int id, String clientId, String status, int energy) {
        GardenPlant p = new GardenPlant();
        p.setId(id);
        p.setUserId(1);
        p.setClientId(clientId);
        p.setPlantType("tea");
        p.setStatus(status);
        p.setEnergy(energy);
        return p;
    }

    @Test
    void upsertCreatesNewPlantWithDefaults() {
        when(plantRepository.findByUserIdAndClientId(1, "c1")).thenReturn(Optional.empty());
        when(plantRepository.save(any(GardenPlant.class))).thenAnswer(inv -> inv.getArgument(0));

        GardenPlantVo vo = service.upsert(1, new GardenPlantCreateRequest("c1", null));

        ArgumentCaptor<GardenPlant> captor = ArgumentCaptor.forClass(GardenPlant.class);
        verify(plantRepository).save(captor.capture());
        GardenPlant saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(1);
        assertThat(saved.getClientId()).isEqualTo("c1");
        assertThat(saved.getPlantType()).isEqualTo("tea"); // 缺省默认 tea
        assertThat(saved.getStatus()).isEqualTo("planted");
        assertThat(saved.getEnergy()).isZero();
        assertThat(vo.status()).isEqualTo("planted");
    }

    @Test
    void upsertIdempotentReturnsExisting() {
        when(plantRepository.findByUserIdAndClientId(1, "c1")).thenReturn(Optional.of(plant(7, "c1", "growing", 120)));

        GardenPlantVo vo = service.upsert(1, new GardenPlantCreateRequest("c1", "tea"));

        assertThat(vo.id()).isEqualTo(7);
        assertThat(vo.energy()).isEqualTo(120);
        verify(plantRepository, never()).save(any());
    }

    @Test
    void upsertConcurrentViolationFallsBackToExisting() {
        when(plantRepository.findByUserIdAndClientId(1, "c1"))
                .thenReturn(Optional.empty(), Optional.of(plant(9, "c1", "planted", 0)));
        when(plantRepository.save(any(GardenPlant.class)))
                .thenThrow(new DataIntegrityViolationException("dup"));

        GardenPlantVo vo = service.upsert(1, new GardenPlantCreateRequest("c1", "tea"));

        assertThat(vo.id()).isEqualTo(9);
    }

    @Test
    void listReturnsOwnPlantsAscending() {
        when(plantRepository.findByUserIdOrderByIdAsc(1))
                .thenReturn(List.of(plant(1, "c1", "planted", 0), plant(2, "c2", "growing", 120)));

        List<GardenPlantVo> result = service.list(1);

        assertThat(result).extracting(GardenPlantVo::id).containsExactly(1, 2);
        assertThat(result.get(1).status()).isEqualTo("growing");
    }
}
