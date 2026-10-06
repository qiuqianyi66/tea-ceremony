package com.tea.record.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tea.auth.security.AuthenticatedUser;
import com.tea.auth.security.JwtAuthenticationFilter;
import com.tea.common.exception.NotFoundException;
import com.tea.common.response.PageResult;
import com.tea.record.dto.RecordCreateRequest;
import com.tea.record.service.TastingRecordService;
import com.tea.record.vo.RecordVo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Controller 层 slice 测试：4 端点映射、@Valid 校验、@AuthenticationPrincipal 注入、ApiResponse 结构。
 * 当前用户通过 SecurityContextHolder 注入（AuthenticationPrincipalArgumentResolver 从上下文解析）。
 */
@WebMvcTest(TastingRecordController.class)
@AutoConfigureMockMvc(addFilters = false)
class TastingRecordControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TastingRecordService recordService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @BeforeEach
    void authenticate() {
        var auth = new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(1, "u1"), null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private RecordVo vo() {
        return new RecordVo(5, "c1", 1, "西湖龙井", 80, 60, 1, "山泉水", null,
                Map.of("bitterness", 3, "sweetness", 4), 8.5, 0.9, "豆香", "好茶", "晴", "平静", null);
    }

    @Test
    void createReturnsRecordVo() throws Exception {
        when(recordService.create(any(Integer.class), any(RecordCreateRequest.class))).thenReturn(vo());

        mockMvc.perform(post("/api/v1/records")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"client_id\":\"c1\",\"tea_name\":\"西湖龙井\",\"tea_id\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.id").value(5))
                .andExpect(jsonPath("$.data.tea_name").value("西湖龙井"))
                .andExpect(jsonPath("$.data.dimensions.bitterness").value(3));

        verify(recordService).create(1, new RecordCreateRequest("c1", 1, "西湖龙井", null, null, null, null, null,
                null, null, null, null, null, null, null));
    }

    @Test
    void createMissingClientIdReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/records")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tea_name\":\"西湖龙井\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PARAM_INVALID"));
    }

    @Test
    void listReturnsPaginatedStructure() throws Exception {
        when(recordService.list(1, 1, 20)).thenReturn(PageResult.of(List.of(vo()), 1, 1, 20));

        mockMvc.perform(get("/api/v1/records"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(5));
    }

    @Test
    void detailReturnsRecordVo() throws Exception {
        when(recordService.getById(1, 5)).thenReturn(vo());

        mockMvc.perform(get("/api/v1/records/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tea_name").value("西湖龙井"));
    }

    @Test
    void detailUnknownIdReturns404() throws Exception {
        when(recordService.getById(1, 99)).thenThrow(new NotFoundException("记录不存在"));

        mockMvc.perform(get("/api/v1/records/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("记录不存在"));
    }

    @Test
    void deleteReturnsMessage() throws Exception {
        mockMvc.perform(delete("/api/v1/records/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("已删除"));

        verify(recordService).delete(1, 5);
    }
}
