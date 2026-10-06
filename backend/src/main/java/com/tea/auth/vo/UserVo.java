package com.tea.auth.vo;

/** 用户摘要（出参）。 */
public record UserVo(Integer id, String username, String displayName, Integer level, Integer xp) {
}
