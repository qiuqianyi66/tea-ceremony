package com.tea.auth.service;

import com.tea.auth.dto.LoginRequest;
import com.tea.auth.dto.RegisterRequest;
import com.tea.auth.entity.User;
import com.tea.auth.repository.UserRepository;
import com.tea.auth.security.AuthenticatedUser;
import com.tea.auth.security.JwtService;
import com.tea.auth.vo.TokenVo;
import com.tea.auth.vo.UserVo;
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

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public TokenVo register(RegisterRequest req) {
        String username = req.username().trim();
        if (userRepository.findByUsername(username).isPresent()) {
            throw new ConflictException("用户名已存在");
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
