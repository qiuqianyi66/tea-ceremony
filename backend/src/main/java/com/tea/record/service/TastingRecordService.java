package com.tea.record.service;

import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.ConflictException;
import com.tea.common.exception.NotFoundException;
import com.tea.common.response.PageResult;
import com.tea.garden.service.GardenEnergyService;
import com.tea.record.dto.RecordCreateRequest;
import com.tea.record.entity.TastingRecord;
import com.tea.record.repository.TastingRecordRepository;
import com.tea.record.vo.RecordVo;
import com.tea.tea.repository.TeaRepository;
import com.tea.ware.repository.TeaWareRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 品鉴记录域（F8-1 幂等创建 / F8-2 列表 / F8-3 详情 / F8-4 删除）。
 * 幂等承重墙（ADR-001）：user_id + client_id 唯一——查重 + 唯一索引并发兜底；
 * 评分可解释性（ADR-002）：dimensions/overall_score/process_factor 前端计算，后端透明存储不重算。
 */
@Service
@RequiredArgsConstructor
public class TastingRecordService {

    private static final int MAX_SIZE = 100;

    private final TastingRecordRepository recordRepository;
    private final TeaRepository teaRepository;
    private final TeaWareRepository teaWareRepository;
    private final GardenEnergyService gardenEnergyService;

    @Transactional
    public RecordVo create(Integer userId, RecordCreateRequest req) {
        if (req.tea_id() != null && !teaRepository.existsById(req.tea_id())) {
            throw new BadRequestException("茶叶不存在");
        }
        if (req.ware_id() != null && !teaWareRepository.existsById(req.ware_id())) {
            throw new BadRequestException("茶器不存在");
        }
        // 幂等：同 user_id + client_id 已存在 → 返回已有记录，不产生新行
        TastingRecord existing = recordRepository.findByUserIdAndClientId(userId, req.client_id()).orElse(null);
        if (existing != null) {
            return RecordVo.from(existing);
        }
        TastingRecord record = new TastingRecord();
        record.setUserId(userId);
        record.setClientId(req.client_id());
        record.setTeaId(req.tea_id());
        record.setTeaName(req.tea_name());
        record.setBrewTemp(req.brew_temp());
        record.setBrewTime(req.brew_time());
        record.setInfusions(req.infusions() != null ? req.infusions() : 1);
        record.setWaterType(req.water_type());
        record.setWareId(req.ware_id());
        record.setDimensions(req.dimensions() != null ? req.dimensions() : Map.of());
        record.setOverallScore(req.overall_score());
        record.setProcessFactor(req.process_factor());
        record.setAromaType(req.aroma_type());
        record.setNotes(req.notes());
        record.setWeather(req.weather());
        record.setMood(req.mood());
        try {
            TastingRecord saved = recordRepository.save(record);
            // S1 能量记账（ADR-015）：同事务，client_id 复用品鉴记录防重；失败整体回滚不污染品鉴
            gardenEnergyService.recordTasting(userId, saved.getClientId(), saved.getNotes());
            return RecordVo.from(saved);
        } catch (DataIntegrityViolationException ex) {
            // 并发同 client_id 提交：唯一索引兜底 → 转幂等返回已有记录
            return RecordVo.from(recordRepository.findByUserIdAndClientId(userId, req.client_id())
                    .orElseThrow(() -> new ConflictException("记录创建冲突，请重试")));
        }
    }

    @Transactional(readOnly = true)
    public PageResult<RecordVo> list(Integer userId, int page, int size) {
        if (page < 1) {
            throw new BadRequestException("page 必须 ≥ 1");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new BadRequestException("size 必须在 1-100 之间");
        }
        Page<TastingRecord> result = recordRepository.findByUserIdOrderByCreatedAtDesc(
                userId, PageRequest.of(page - 1, size));
        return PageResult.of(
                result.getContent().stream().map(RecordVo::from).toList(),
                result.getTotalElements(), page, size);
    }

    @Transactional(readOnly = true)
    public RecordVo getById(Integer userId, Integer id) {
        TastingRecord record = recordRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("记录不存在"));
        return RecordVo.from(record);
    }

    @Transactional
    public void delete(Integer userId, Integer id) {
        TastingRecord record = recordRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("记录不存在"));
        recordRepository.delete(record);
    }
}
