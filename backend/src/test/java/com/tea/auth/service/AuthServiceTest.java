package com.tea.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.auth.dto.LoginRequest;
import com.tea.auth.dto.RegisterRequest;
import com.tea.auth.entity.User;
import com.tea.auth.repository.UserRepository;
import com.tea.auth.security.JwtService;
import com.tea.auth.vo.TokenVo;
import com.tea.common.exception.ConflictException;
import com.tea.common.exception.UnauthorizedException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String SECRET = "test-secret-key-0123456789-0123456789-0123456789";

    @Mock
    private UserRepository userRepository;

    private PasswordEncoder passwordEncoder;
    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        jwtService = new JwtService(SECRET, 60, Clock.fixed(Instant.parse("2026-10-05T00:00:00Z"), ZoneOffset.UTC));
        authService = new AuthService(userRepository, passwordEncoder, jwtService);
    }

    @Test
    void registerPersistsBcryptHashedPasswordAndReturnsToken() {
        when(userRepository.findByUsername("tea_lover")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1);
            return u;
        });

        TokenVo vo = authService.register(new RegisterRequest("tea_lover", "茶友", "secret123"));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.getHashedPassword()).isNotEqualTo("secret123");
        assertThat(passwordEncoder.matches("secret123", saved.getHashedPassword())).isTrue();
        assertThat(saved.getLevel()).isEqualTo(1);
        assertThat(saved.getXp()).isZero();
        assertThat(vo.user().username()).isEqualTo("tea_lover");
        assertThat(vo.user().displayName()).isEqualTo("茶友");
        assertThat(jwtService.parse(vo.token()).username()).isEqualTo("tea_lover");
    }

    @Test
    void registerDefaultsDisplayNameToUsername() {
        when(userRepository.findByUsername("tea_lover")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1);
            return u;
        });

        TokenVo vo = authService.register(new RegisterRequest("tea_lover", null, "secret123"));

        assertThat(vo.user().displayName()).isEqualTo("tea_lover");
    }

    @Test
    void registerDuplicateUsernameThrowsConflict() {
        when(userRepository.findByUsername("dup")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> authService.register(new RegisterRequest("dup", "", "secret123")))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void loginSuccessReturnsTokenForKnownUser() {
        User user = new User();
        user.setId(7);
        user.setUsername("tea_lover");
        user.setHashedPassword(passwordEncoder.encode("secret123"));
        when(userRepository.findByUsername("tea_lover")).thenReturn(Optional.of(user));

        TokenVo vo = authService.login(new LoginRequest("tea_lover", "secret123"));

        assertThat(vo.user().id()).isEqualTo(7);
        assertThat(jwtService.parse(vo.token()).id()).isEqualTo(7);
    }

    @Test
    void loginWrongPasswordThrowsUnauthorized() {
        User user = new User();
        user.setHashedPassword(passwordEncoder.encode("correct-password"));
        when(userRepository.findByUsername("tea_lover")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(new LoginRequest("tea_lover", "wrong-password")))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("用户名或密码错误");
    }

    @Test
    void loginUnknownUserThrowsUnauthorizedWithSameMessage() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("ghost", "whatever")))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("用户名或密码错误");
    }
}
