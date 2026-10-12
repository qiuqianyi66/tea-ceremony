package com.tea.auth.service;

import com.tea.auth.dto.LoginRequest;
import com.tea.auth.dto.RegisterRequest;
import com.tea.auth.entity.User;
import com.tea.auth.repository.UserRepository;
import com.tea.auth.security.AuthenticatedUser;
import com.tea.auth.security.JwtService;
import com.tea.auth.vo.TokenVo;
import com.tea.auth.vo.UserVo;
import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.ConflictException;
import com.tea.common.exception.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 注册/登录（编码规范 §7：BCrypt 哈希 + JWT）。
 * 登录失败统一"用户名或密码错误"，不泄露账号是否存在。
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String LOGIN_FAILED = "用户名或密码错误";

    /** 常见弱密码黑名单（L2，安全审计 2026-10-12）：防弱密码爆破面 */
    private static final java.util.Set<String> WEAK_PASSWORDS = java.util.Set.of(
            "12345678", "123456789", "1234567890", "password", "password123",
            "qwerty", "qwerty123", "admin123", "letmein", "11111111",
            "88888888", "abcd1234", "iloveyou", "welcome1", "monkey123", "abc12345");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional(rollbackFor = Exception.class)
    public TokenVo register(RegisterRequest req) {
        String username = req.username().trim();
        if (userRepository.findByUsername(username).isPresent()) {
            throw new ConflictException("用户名已存在");
        }
        String password = req.password();
        if (WEAK_PASSWORDS.contains(password.toLowerCase())) {
            throw new BadRequestException("密码过于常见，请更换");
        }
        User user = new User();
        user.setUsername(username);
        user.setDisplayName(blankToNull(req.displayName()) == null ? username : req.displayName().trim());
        user.setHashedPassword(passwordEncoder.encode(req.password()));
        user.setLevel(1);
        user.setXp(0);
        User saved = userRepository.save(user);
        return buildToken(saved);
    }

    @Transactional(readOnly = true)
    public TokenVo login(LoginRequest req) {
        User user = userRepository.findByUsername(req.username().trim())
                .orElseThrow(() -> new UnauthorizedException(LOGIN_FAILED));
        if (!passwordEncoder.matches(req.password(), user.getHashedPassword())) {
            throw new UnauthorizedException(LOGIN_FAILED);
        }
        return buildToken(user);
    }

    private TokenVo buildToken(User user) {
        AuthenticatedUser principal = new AuthenticatedUser(user.getId(), user.getUsername());
        return new TokenVo(
                jwtService.generate(principal),
                jwtService.expirationSeconds(),
                new UserVo(user.getId(), user.getUsername(), user.getDisplayName(), user.getLevel(), user.getXp()));
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
