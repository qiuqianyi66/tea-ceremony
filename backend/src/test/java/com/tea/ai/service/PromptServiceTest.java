package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.tea.ai.entity.AgentPrompt;
import com.tea.ai.repository.PromptRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PromptServiceTest {

    @Mock
    private PromptRepository promptRepository;

    private PromptService service;

    @BeforeEach
    void setUp() {
        service = new PromptService(promptRepository);
    }

    private AgentPrompt prompt(String content) {
        AgentPrompt p = new AgentPrompt();
        p.setAgent("librarian");
        p.setVersion("v2");
        p.setContent(content);
        p.setStatus("active");
        return p;
    }

    @Test
    void activeVersionOverridesFallback() {
        when(promptRepository.findFirstByAgentAndStatusOrderByUpdatedAtDesc("librarian", "active"))
                .thenReturn(Optional.of(prompt("你是新版学者")));

        String result = service.getPrompt("librarian", "内置常量");

        assertThat(result).isEqualTo("你是新版学者");
    }

    @Test
    void noActiveVersionFallsBackToConstant() {
        when(promptRepository.findFirstByAgentAndStatusOrderByUpdatedAtDesc("librarian", "active"))
                .thenReturn(Optional.empty());

        String result = service.getPrompt("librarian", "内置常量");

        assertThat(result).isEqualTo("内置常量");
    }
}
