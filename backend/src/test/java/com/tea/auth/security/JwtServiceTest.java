package com.tea.auth.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.JwtException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "test-secret-key-0123456789-0123456789-0123456789";
    private static final Instant NOW = Instant.parse("2026-10-05T00:00:00Z");

    @Test
    void roundTripReturnsSameSubjectAndUid() {
        JwtService service = new JwtService(SECRET, 60, Clock.fixed(NOW, ZoneOffset.UTC));
        String token = service.generate(new AuthenticatedUser(1, "tea_lover"));

        AuthenticatedUser parsed = service.parse(token);

        assertThat(parsed.id()).isEqualTo(1);
        assertThat(parsed.username()).isEqualTo("tea_lover");
    }

    @Test
    void expirationSecondsMatchesConfiguredMinutes() {
        JwtService service = new JwtService(SECRET, 1440, Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(service.expirationSeconds()).isEqualTo(86_400L);
    }

    @Test
    void expiredTokenIsRejected() {
        JwtService issuer = new JwtService(SECRET, 60, Clock.fixed(NOW, ZoneOffset.UTC));
        JwtService verifier = new JwtService(
                SECRET, 60, Clock.fixed(NOW.plusSeconds(3601), ZoneOffset.UTC)); // 签发 60 分钟后校验
        String token = issuer.generate(new AuthenticatedUser(2, "old_user"));

        assertThatThrownBy(() -> verifier.parse(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void tamperedTokenIsRejected() {
        JwtService service = new JwtService(SECRET, 60, Clock.fixed(NOW, ZoneOffset.UTC));
        String token = service.generate(new AuthenticatedUser(3, "tea_lover"));
        String tampered = token.substring(0, token.length() - 2) + "xx";

        assertThatThrownBy(() -> service.parse(tampered)).isInstanceOf(JwtException.class);
    }

    @Test
    void shortSecretIsRejectedAtConstruction() {
        assertThatThrownBy(() -> new JwtService("too-short", 60, Clock.fixed(NOW, ZoneOffset.UTC)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
