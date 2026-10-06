package com.tea.tea.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tea.auth.security.JwtAuthenticationFilter;
import com.tea.common.exception.NotFoundException;
import com.tea.common.response.PageResult;
import com.tea.tea.service.TeaService;
import com.tea.tea.vo.TeaVo;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Controller 层 slice 测试：MVC 映射 / 参数传递 / ApiResponse 分页结构 / 异常契约。
 * 禁用 Security 过滤链（addFilters=false）——游客放行由集成测试覆盖；
 * 全局异常处理（@RestControllerAdvice）由 @WebMvcTest 自动加载。
 */
@WebMvcTest(TeaController.class)
@AutoConfigureMockMvc(addFilters = false)
class TeaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TeaService teaService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private TeaVo teaVo() {
        return new TeaVo(1, "西湖龙井", "绿茶", "浙江杭州",
                null, null, "明前", null, "300-800米",
                80, 60, 3, List.of("豆香", "栗香", "鲜爽"),
                "乾隆亲封十八棵御茶。", "中国十大名茶之首。", null, null,
                "#F5E6A3", "#C9B458", "#4A7C59");
    }

    @Test
    void listReturnsPaginatedStructure() throws Exception {
        when(teaService.list(null, null, 1, 20))
                .thenReturn(PageResult.of(List.of(teaVo()), 66, 1, 20));

        mockMvc.perform(get("/api/v1/teas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.total").value(66))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.items[0].name").value("西湖龙井"))
                .andExpect(jsonPath("$.data.items[0].soup_color_min").value("#F5E6A3"))
                .andExpect(jsonPath("$.data.items[0].flavor[0]").value("豆香"));
    }

    @Test
    void listPassesFilterAndPaginationParams() throws Exception {
        when(teaService.list("绿茶", "杭州", 2, 10))
                .thenReturn(PageResult.of(List.of(), 0, 2, 10));

        mockMvc.perform(get("/api/v1/teas")
                        .param("category", "绿茶")
                        .param("origin", "杭州")
                        .param("page", "2")
                        .param("size", "10"))
                .andExpect(status().isOk());

        verify(teaService).list("绿茶", "杭州", 2, 10);
    }

    @Test
    void listWithNonNumericSizeReturns400() throws Exception {
        mockMvc.perform(get("/api/v1/teas").param("size", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PARAM_INVALID"))
                .andExpect(jsonPath("$.message").value("参数格式错误"));
    }

    @Test
    void detailReturnsTeaVo() throws Exception {
        when(teaService.getById(1)).thenReturn(teaVo());

        mockMvc.perform(get("/api/v1/teas/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.name").value("西湖龙井"))
                .andExpect(jsonPath("$.data.best_temp").value(80));
    }

    @Test
    void detailUnknownIdReturns404() throws Exception {
        when(teaService.getById(999)).thenThrow(new NotFoundException("茶叶不存在"));

        mockMvc.perform(get("/api/v1/teas/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("茶叶不存在"));
    }
}
