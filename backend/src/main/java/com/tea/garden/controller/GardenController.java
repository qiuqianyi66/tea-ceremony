package com.tea.garden.controller;

import com.tea.auth.security.AuthenticatedUser;
import com.tea.common.response.ApiResponse;
import com.tea.garden.dto.GardenPlantCreateRequest;
import com.tea.garden.service.GardenEnergyService;
import com.tea.garden.service.GardenPlantService;
import com.tea.garden.vo.GardenEnergySummaryVo;
import com.tea.garden.vo.GardenPlantVo;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 茶园接口（/api/v1/garden-plants、/api/v1/garden-energy，全部需登录）。
 * Controller 只做参数与响应；幂等/归属校验在 Service。
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class GardenController {

    private final GardenPlantService plantService;
    private final GardenEnergyService energyService;

    @PostMapping("/garden-plants")
    public ApiResponse<GardenPlantVo> createPlant(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @Valid @RequestBody GardenPlantCreateRequest req) {
        return ApiResponse.success(plantService.upsert(user.id(), req));
    }

    @GetMapping("/garden-plants")
    public ApiResponse<List<GardenPlantVo>> listPlants(@AuthenticationPrincipal AuthenticatedUser user) {
        return ApiResponse.success(plantService.list(user.id()));
    }

    @GetMapping("/garden-energy")
    public ApiResponse<GardenEnergySummaryVo> energySummary(@AuthenticationPrincipal AuthenticatedUser user) {
        return ApiResponse.success(energyService.summary(user.id()));
    }

    @PostMapping("/garden-energy/collect")
    public ApiResponse<GardenEnergySummaryVo> collect(@AuthenticationPrincipal AuthenticatedUser user) {
        return ApiResponse.success(energyService.collect(user.id()));
    }
}
