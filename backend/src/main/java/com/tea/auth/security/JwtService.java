package com.tea.auth.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * JWT 签发与解析（HMAC-SHA256）。
 * 纯逻辑类：依赖 SecretKey + Clock + 过期时长，便于单测固定时钟。
 */
@Component
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;
    private final Clock clock;

    public JwtService(
            @Value("${tea.jwt.secret}") String secret,
            @Value("${tea.jwt.expiration-minutes}") long expirationMinutes,
            Clock clock) {
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("tea.jwt.secret 必须 ≥ 32 字节（HS256 要求）");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMinutes * 60_000L;
        this.clock = clock;
    }

    /** 签发 token：sub=username，claim uid=userId。 */
    public String generate(AuthenticatedUser user) {
        Instant now = clock.instant();
        return Jwts.builder()
                .subject(user.username())
                .claim("uid", user.id())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(expirationMs)))
                .signWith(key)
                .compact();
    }

    /**
     * 解析 token，返回已认证主体。
     *
     * @throws JwtException token 非法 / 过期 / 签名不符
     */
    public AuthenticatedUser parse(String token) throws JwtException {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .clock(() -> Date.from(clock.instant()))
                .build()
                .parseSignedClaims(token)
                .getPayload();
        Integer uid = claims.get("uid", Integer.class);
        String username = claims.getSubject();
        return new AuthenticatedUser(uid, username);
    }

    /** token 有效期（秒），随响应返回供前端刷新用。 */
    public long expirationSeconds() {
        return expirationMs / 1000L;
    }
}
