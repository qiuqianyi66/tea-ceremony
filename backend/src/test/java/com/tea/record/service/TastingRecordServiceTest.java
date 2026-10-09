package com.tea.record.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.NotFoundException;
import com.tea.common.response.PageResult;
import com.tea.garden.service.GardenEnergyService;
import com.tea.record.dto.RecordCreateRequest;
import com.tea.record.entity.TastingRecord;
import com.tea.record.repository.TastingRecordRepository;
import com.tea.record.vo.RecordVo;
import com.tea.tea.repository.TeaRepository;
import com.tea.ware.repository.TeaWareRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

@ExtendWith(MockitoExtension.class)
class TastingRecordServiceTest {

    @Mock
    private TastingRecordRepository recordRepository;

    @Mock
    private TeaRepository teaRepository;

    @Mock
    private TeaWareRepository teaWareRepository;

    @Mock
    private GardenEnergyService gardenEnergyService;

    private TastingRecordService service;

    @BeforeEach
    void setUp() {
        service = new TastingRecordService(recordRepository, teaRepository, teaWareRepository, gardenEnergyService);
    }

    private RecordCreateRequest req(String clientId, Integer teaId, Integer wareId, Integer infusions) {
        return new RecordCreateRequest(clientId, teaId, "西湖龙井", 80, 60, infusions, "山泉水", wareId,
                Map.of("bitterness", 3, "sweetness", 4), 8.5, 0.9, "豆香", "好茶", "晴", "平静");
    }

    private TastingRecord record(int id, String clientId) {
        TastingRecord r = new TastingRecord();
        r.setId(id);
        r.setUserId(1);
        r.setClientId(clientId);
        r.setTeaName("西湖龙井");
        return r;
    }

    @Test
    void createPersistsNewRecordWithDefaults() {
        when(recordRepository.findByUserIdAndClientId(1, "c1")).thenReturn(Optional.empty());
        when(teaRepository.existsById(1)).thenReturn(true);
        when(recordRepository.save(any(TastingRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        RecordVo vo = service.create(1, req("c1", 1, null, null));

        ArgumentCaptor<TastingRecord> captor = ArgumentCaptor.forClass(TastingRecord.class);
        verify(recordRepository).save(captor.capture());
        TastingRecord saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(1);
        assertThat(saved.getClientId()).isEqualTo("c1");
        assertThat(saved.getTeaName()).isEqualTo("西湖龙井");
        assertThat(saved.getTeaId()).isEqualTo(1);
        assertThat(saved.getInfusions()).isEqualTo(1); // 缺省默认 1
        assertThat(saved.getDimensions()).containsEntry("bitterness", 3);
        assertThat(vo.tea_name()).isEqualTo("西湖龙井");
    }

    @Test
    void createIdempotentReturnsExistingWithoutSaving() {
        TastingRecord existing = record(7, "c1");
        when(recordRepository.findByUserIdAndClientId(1, "c1")).thenReturn(Optional.of(existing));

        RecordVo vo = service.create(1, req("c1", null, null, null));

        assertThat(vo.id()).isEqualTo(7);
        verify(recordRepository, never()).save(any());
    }

    @Test
    void createWithUnknownTeaRejects() {
        when(teaRepository.existsById(99)).thenReturn(false);

        assertThatThrownBy(() -> service.create(1, req("c1", 99, null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("茶叶不存在");
    }

    @Test
    void createWithUnknownWareRejects() {
        when(teaRepository.existsById(1)).thenReturn(true);
        when(teaWareRepository.existsById(88)).thenReturn(false);

        assertThatThrownBy(() -> service.create(1, req("c1", 1, 88, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("茶器不存在");
    }

    @Test
    void listReturnsOwnRecordsDescendingPage() {
        when(recordRepository.findByUserIdOrderByCreatedAtDesc(eq(1), eq(PageRequest.of(0, 20))))
                .thenReturn(new PageImpl<>(List.of(record(2, "c2"), record(1, "c1")), PageRequest.of(0, 20), 2));

        PageResult<RecordVo> result = service.list(1, 1, 20);

        assertThat(result.total()).isEqualTo(2);
        assertThat(result.page()).isEqualTo(1);
        assertThat(result.size()).isEqualTo(20);
        assertThat(result.items()).extracting(RecordVo::id).containsExactly(2, 1);
    }

    @Test
    void listRejectsOversize() {
        assertThatThrownBy(() -> service.list(1, 1, 101))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("size 必须在 1-100 之间");
    }

    @Test
    void listRejectsZeroPage() {
        assertThatThrownBy(() -> service.list(1, 0, 20))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("page 必须 ≥ 1");
    }

    @Test
    void getByIdReturnsOwnRecord() {
        when(recordRepository.findByIdAndUserId(5, 1)).thenReturn(Optional.of(record(5, "c5")));

        RecordVo vo = service.getById(1, 5);

        assertThat(vo.id()).isEqualTo(5);
    }

    @Test
    void getByIdMissingOrOthersThrows404() {
        when(recordRepository.findByIdAndUserId(5, 1)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getById(1, 5))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("记录不存在");
    }

    @Test
    void deleteRemovesOwnRecord() {
        when(recordRepository.findByIdAndUserId(5, 1)).thenReturn(Optional.of(record(5, "c5")));

        service.delete(1, 5);

        verify(recordRepository).delete(any(TastingRecord.class));
    }

    @Test
    void deleteMissingOrOthersThrows404() {
        when(recordRepository.findByIdAndUserId(5, 1)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(1, 5))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("记录不存在");
    }
}
