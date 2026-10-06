package com.tea.auth.vo;

/** 登录/注册成功响应。 */
public record TokenVo(String token, long expiresInSeconds, UserVo user) {
}
