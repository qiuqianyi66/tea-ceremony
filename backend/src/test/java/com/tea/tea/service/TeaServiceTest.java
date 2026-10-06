package com.tea.tea.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.NotFoundException;
import com.tea.common.response.PageResult;
import com.tea.tea.entity.Tea;
import com.tea.tea.repository.TeaRepository;
import com.tea.tea.vo.TeaVo;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

@ExtendWith(MockitoExtension.class)
class TeaServiceTest {

    @Mock
    private TeaRepository teaRepository;

    private TeaService teaService;

    @BeforeEach
    void setUp() {
        teaService = new TeaService(teaRepository);
    }

    private Tea tea(int id, String name, String category, String origin) {
        Tea tea = new Tea();
        tea.setId(id);
        tea.setName(name);
        tea.setCategory(category);
        tea.setOrigin(origin);
        return tea;
    }

    @Test
    void listReturnsPaginatedResultSortedById() {
        when(teaRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(tea(1, "西湖龙井", "绿茶", "浙江杭州")),
                        PageRequest.of(0, 20), 1));

        PageResult<TeaVo> result = teaService.list(null, null, 1, 20);

        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).name()).isEqualTo("西湖龙井");
        assertThat(result.total()).isEqualTo(1);
        assertThat(result.page()).isEqualTo(1);
        assertThat(result.size()).isEqualTo(20);
        verify(teaRepository).findAll(any(Specification.class), eq(PageRequest.of(0, 20, Sort.by("id"))));
    }

    @Test
    void listPassesOneBasedPageAndSortToRepository() {
        when(teaRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(2, 10), 0));

        teaService.list("绿茶", "杭州", 3, 10);

        verify(teaRepository).findAll(any(Specification.class), eq(PageRequest.of(2, 10, Sort.by("id"))));
    }

    @Test
    void listRejectsSizeOverLimit() {
        assertThatThrownBy(() -> teaService.list(null, null, 1, 101))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("size 必须在 1-100 之间");
    }

    @Test
    void listRejectsZeroPage() {
        assertThatThrownBy(() -> teaService.list(null, null, 0, 20))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("page 必须 ≥ 1");
    }

    @Test
    void getByIdReturnsFullVo() {
        Tea tea = tea(1, "西湖龙井", "绿茶", "浙江杭州");
        tea.setBestTemp(80);
        tea.setBestTime(60);
        tea.setInfusions(3);
        tea.setFlavor(List.of("豆香", "栗香", "鲜爽"));
        tea.setStory("乾隆亲封十八棵御茶。");
        tea.setSoupColorMin("#F5E6A3");
        tea.setSoupColorMax("#C9B458");
        tea.setDryTeaColor("#4A7C59");
        tea.setSeason("明前");
        when(teaRepository.findById(1)).thenReturn(Optional.of(tea));

        TeaVo vo = teaService.getById(1);

        assertThat(vo.name()).isEqualTo("西湖龙井");
        assertThat(vo.category()).isEqualTo("绿茶");
        assertThat(vo.best_temp()).isEqualTo(80);
        assertThat(vo.flavor()).containsExactly("豆香", "栗香", "鲜爽");
        assertThat(vo.soup_color_min()).isEqualTo("#F5E6A3");
        assertThat(vo.dry_tea_color()).isEqualTo("#4A7C59");
        assertThat(vo.season()).isEqualTo("明前");
    }

    @Test
    void getByIdUnknownThrowsNotFound() {
        when(teaRepository.findById(99)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> teaService.getById(99))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("茶叶不存在");
    }
}
