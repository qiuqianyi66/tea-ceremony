---
title: repo-map
last_updated: 2026-10-09
---

# 一盏茶 仓库地图（自动生成）

> 由 `node scripts/gen-repomap.cjs` 生成，勿手改。抽查符号缺失会 exit 1（防漂移）。
> 范围：src / backend/src/main/java / scripts / docs（跳过 node_modules/dist/target/.git 等）。

## 目录树

```
  📄 App.vue
  assets/
    📄 blue-white-porcelain.jpg
    📄 main.css
    📄 SOURCES.md
    📄 tea-mountain-hero.jpg
    teas/
      📄 dark-fuzhuan.jpg
      📄 dark-liubao.jpg
      📄 dark-shengpu.jpg
      📄 dark-shoupu.jpg
      📄 green-anji.jpg
      📄 green-biluochun.jpg
      📄 green-common-1.jpg
      📄 green-common-2.jpg
      📄 green-huangshanmaofeng.jpg
      📄 green-longjing.jpg
      📄 green-taipinghoukui.jpg
      📄 green-xinyangmaojian.jpg
      📄 oolong-dahongpao.jpg
      📄 oolong-wuyi.jpg
      📄 red-common.jpg
      📄 red-dianhong.jpg
      📄 red-jinjunmei.jpg
      📄 red-qimen.jpg
      📄 white-baimudan.jpg
      📄 white-yinzhen.jpg
      📄 yellow-junshan.jpg
    wares/
      📄 ware-gaiwan.jpg
      📄 ware-glass.jpg
      📄 ware-jianzhan.jpg
      📄 ware-zisha.jpg
    📄 zisha-albedo.jpg
  components/
    __tests__/
      📄 PwaUpdateToast.spec.ts
    brewing/
      📄 TeaDragDrop.vue
    common/
    📄 PwaUpdateToast.vue
    tasting/
      📄 TasteProfileSection.vue
      📄 TasteRadarChart.vue
      📄 TasteTrendChart.vue
      📄 TastingCard.vue
      📄 TeaKnowledgeCard.vue
    📄 TeaSoup.vue
    three/
      📄 ambient-audio.ts
      📄 brewSkins.ts
      📄 garden-ambient.ts
      📄 garden-animals.ts
      📄 garden-ecology.ts
      📄 garden-presets.ts
      📄 garden-scenery.ts
      📄 garden-weather.ts
      📄 tea-field.ts
      📄 tea-plant.ts
      📄 tea-tree.ts
      📄 TeaBrewScene3D.vue
      📄 TeaBrewSceneInner.vue
      📄 TeaGardenScene3D.vue
      📄 TeaGardenSceneInner.vue
      📄 terrain.ts
    ui/
      📄 BaseButton.vue
      📄 BaseCard.vue
      📄 BaseSpinner.vue
      📄 EmptyState.vue
      📄 ErrorState.vue
      📄 index.ts
      📄 ToastContainer.vue
  composables/
    __tests__/
      📄 useAudio.spec.ts
    📄 useAudio.ts
    📄 useBrewAnimation.ts
    📄 useParticles.ts
    📄 useToast.ts
  data/
    __tests__/
      📄 solarTerms.spec.ts
      📄 tea-regions.spec.ts
    📄 china-map.json
    📄 constants.ts
    📄 gardenRegions.ts
    📄 solarTerms.ts
    📄 tea-mountain-regions.ts
    📄 tea-regions.ts
    📄 teaEtiquette.ts
    📄 teaMasters.ts
    📄 teaPoems.ts
    📄 teaProcesses.ts
    📄 teas.ts
    📄 teawares.ts
    📄 themes.ts
  📄 main.ts
  plugins/
    📄 icons.ts
  router/
    📄 index.ts
  services/
    __tests__/
      📄 errorBuffer.spec.ts
      📄 garden.spec.ts
      📄 growth.spec.ts
      📄 scoring.spec.ts
      📄 share.spec.ts
      📄 storage.spec.ts
      📄 tasteProfile.spec.ts
      📄 teaAI.spec.ts
      📄 teaRecommend.spec.ts
      📄 tracking.perf.spec.ts
      📄 tracking.spec.ts
      📄 vitals.spec.ts
    api/
      __tests__/
        📄 api.spec.ts
      📄 auth.ts
      📄 garden.ts
      📄 index.ts
      📄 records.ts
      📄 teas.ts
    📄 authStorage.ts
    📄 errorBuffer.ts
    📄 garden.ts
    📄 growth.ts
    📄 http.ts
    📄 scoring.ts
    📄 share.ts
    storage/
      __tests__/
        📄 export.spec.ts
      📄 achievement.ts
      📄 collectedWare.ts
      📄 db.ts
      📄 export.ts
      📄 history.ts
      📄 index.ts
      📄 settings.ts
      📄 xp.ts
    📄 tasteProfile.ts
    📄 teaAI.ts
    📄 teaRecommend.ts
    📄 tracking.ts
    📄 vitals.ts
  stores/
    __tests__/
      📄 tea.spec.ts
    📄 auth.ts
    📄 brew.ts
    📄 progress.ts
    📄 record.ts
    📄 taste.ts
    📄 tea.ts
    📄 teaRoom.ts
    📄 theme.ts
    📄 ui.ts
  styles/
    📄 colorTokens.ts
  test/
    mocks/
      📄 virtual-pwa-register.ts
    📄 setup.ts
  types/
    📄 brewing.ts
    📄 errors.ts
    📄 garden.ts
    📄 tasting.ts
    📄 tea.ts
    📄 teaware.ts
    📄 tracking.ts
    📄 vitals.ts
  views/
    📄 AIAsk.vue
    break/
      📄 TeaTreeCanvas.vue
    brew/
      📄 CeremonyProgress.vue
    📄 BrewView.vue
    📄 CollectionView.vue
    garden/
      📄 GardenRegionPicker.vue
    📄 GardenView.vue
    📄 GrowthView.vue
    📄 HealthView.vue
    📄 HistoryView.vue
    home/
      📄 HomeDrawer.vue
      📄 HomeHero.vue
      📄 HomeTeaCard.vue
    📄 HomeView.vue
    📄 LoginView.vue
    📄 MapView.vue
    📄 SelectView.vue
    📄 ShareView.vue
    taste/
      📄 TasteObserveStep.vue
      📄 TasteStepIndicator.vue
    📄 TasteView.vue
    📄 TeaBreakView.vue
    📄 TeaDetailView.vue
    📄 TeaGraph.vue
    📄 TeaProfile.vue
    📄 TeaRoom.vue
    📄 TeaSynesthesiaView.vue
    📄 ToolSelect.vue
        com/
          tea/
            ai/
              agent/
                📄 AdvisorAgent.java
                📄 AgentOrchestrator.java
                📄 AgentType.java
                📄 BaseExpertAgent.java
                📄 BrewerAgent.java
                📄 ComplexityLevel.java
                📄 LibrarianAgent.java
                📄 MentorAgent.java
                📄 TasterAgent.java
              controller/
                📄 AiChatController.java
                📄 AiSessionController.java
              dto/
                📄 AiChatRequest.java
                📄 ChatMessageDto.java
                📄 SessionCreateRequest.java
              entity/
                📄 AgentPrompt.java
                📄 AgentSkill.java
                📄 AiChatMessage.java
                📄 AiChatSession.java
                📄 AiEvalTrace.java
                📄 AiUsageLog.java
              mcp/
                📄 CultureSearchTool.java
                📄 McpToolConfig.java
              repository/
                📄 AgentSkillRepository.java
                📄 AiChatMessageRepository.java
                📄 AiChatSessionRepository.java
                📄 AiEvalTraceRepository.java
                📄 AiUsageLogRepository.java
                📄 PromptRepository.java
              service/
                📄 AgentSkillRouter.java
                📄 AiChatService.java
                📄 AiUsageLogger.java
                📄 ChatMemoryService.java
```
（目录条目 605 个，仅展示前 250 行）

## 关键符号抽查（8/8 命中）

- ✅ 命中 src/services/teaAI.ts
- ✅ 命中 src/data/teaProcesses.ts
- ✅ 命中 src/stores
- ✅ 命中 src/components/three
- ✅ 命中 后端 AiChatService
- ✅ 命中 后端 LibrarianAgent
- ✅ 命中 后端 RateLimitFilter
- ✅ 命中 活文档 TODO-PRIORITY

