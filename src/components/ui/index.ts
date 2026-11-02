/**
 * 基础 UI 组件库统一导出
 * 设计基线见 DESIGN_SPEC.md：宣纸白 / 木色 / 茶汤金
 *
 * 文件名统一 Base* 前缀（组件名多词，避免与原生标签混淆）；导出名保持简短，
 * 业务侧写 `<Button>` `<Card>` `<Modal>` 即可。
 *
 * 容器与展示：Card / Badge / SectionHeader / PageHeader / EmptyState / BaseSpinner
 * 交互与动作：Button / PillButton / Tooltip / Modal / Tabs
 * 反馈：ToastContainer
 */
export { default as Badge } from './BaseBadge.vue'
export { default as BaseSpinner } from './BaseSpinner.vue'
export { default as Button } from './BaseButton.vue'
export { default as Card } from './BaseCard.vue'
export { default as EmptyState } from './EmptyState.vue'
export { default as Modal } from './BaseModal.vue'
export { default as PageHeader } from './PageHeader.vue'
export { default as PillButton } from './PillButton.vue'
export { default as SectionHeader } from './SectionHeader.vue'
export { default as Tabs } from './BaseTabs.vue'
export { default as ToastContainer } from './ToastContainer.vue'
export { default as Tooltip } from './BaseTooltip.vue'
