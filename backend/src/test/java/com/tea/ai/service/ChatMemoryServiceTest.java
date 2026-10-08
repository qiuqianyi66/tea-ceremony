package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.ai.entity.AiChatMessage;
import com.tea.ai.entity.AiChatSession;
import com.tea.ai.repository.AiChatMessageRepository;
import com.tea.ai.repository.AiChatSessionRepository;
import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.NotFoundException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class ChatMemoryServiceTest {

    @Mock
    private AiChatSessionRepository sessionRepository;

    @Mock
    private AiChatMessageRepository messageRepository;

    private ChatMemoryService service;

    @BeforeEach
    void setUp() {
        service = new ChatMemoryService(sessionRepository, messageRepository);
    }

    private AiChatSession session(int id) {
        AiChatSession s = new AiChatSession();
        s.setId(id);
        s.setUserId(1);
        s.setTopic("龙井");
        s.setAgent("advisor");
        return s;
    }

    private AiChatMessage message(int id) {
        AiChatMessage m = new AiChatMessage();
        m.setId(id);
        m.setSessionId(9);
        m.setRole("user");
        m.setContent("问");
        return m;
    }

    @Test
    void createSessionPersistsUserTopicAgent() {
        when(sessionRepository.save(any(AiChatSession.class))).thenAnswer(inv -> {
            AiChatSession s = inv.getArgument(0);
            s.setId(7);
            return s;
        });

        AiChatSession saved = service.createSession(1, "龙井", "advisor");

        ArgumentCaptor<AiChatSession> captor = ArgumentCaptor.forClass(AiChatSession.class);
        verify(sessionRepository).save(captor.capture());
        AiChatSession captured = captor.getValue();
        assertThat(captured.getUserId()).isEqualTo(1);
        assertThat(captured.getTopic()).isEqualTo("龙井");
        assertThat(captured.getAgent()).isEqualTo("advisor");
        assertThat(saved.getId()).isEqualTo(7);
    }

    @Test
    void createSessionRejectsGuest() {
        assertThatThrownBy(() -> service.createSession(null, "龙井", "advisor"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("游客不落会话");
    }

    @Test
    void appendMessagePersistsRoleContentAgentTokens() {
        service.appendMessage(9, "user", "问", "advisor", 12);

        ArgumentCaptor<AiChatMessage> captor = ArgumentCaptor.forClass(AiChatMessage.class);
        verify(messageRepository).save(captor.capture());
        AiChatMessage saved = captor.getValue();
        assertThat(saved.getSessionId()).isEqualTo(9);
        assertThat(saved.getRole()).isEqualTo("user");
        assertThat(saved.getContent()).isEqualTo("问");
        assertThat(saved.getAgent()).isEqualTo("advisor");
        assertThat(saved.getTokens()).isEqualTo(12);
    }

    @Test
    void historyReturnsRecentAscending() {
        when(messageRepository.findBySessionIdOrderByIdDesc(eq(9), any(Pageable.class)))
                .thenReturn(List.of(message(3), message(2), message(1)));

        List<AiChatMessage> history = service.history(9, 20);

        assertThat(history).extracting(AiChatMessage::getId).containsExactly(1, 2, 3);
    }

    @Test
    void historyRejectsOversizeLimit() {
        assertThatThrownBy(() -> service.history(9, 101))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("limit 必须在 1-100 之间");
    }

    @Test
    void sessionsByUserReturnsDesc() {
        when(sessionRepository.findByUserIdOrderByUpdatedAtDesc(1))
                .thenReturn(List.of(session(2), session(1)));

        List<AiChatSession> sessions = service.sessions(1);

        assertThat(sessions).extracting(AiChatSession::getId).containsExactly(2, 1);
    }

    @Test
    void deleteSessionDeletesOwned() {
        when(sessionRepository.findByIdAndUserId(5, 1)).thenReturn(Optional.of(session(5)));

        service.deleteSession(1, 5);

        verify(sessionRepository).delete(any(AiChatSession.class));
    }

    @Test
    void deleteSessionMissingOrOthersThrows404() {
        when(sessionRepository.findByIdAndUserId(5, 1)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteSession(1, 5))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("会话不存在");
        verify(sessionRepository, never()).delete(any());
    }

    @Test
    void listMessagesOwnedReturnsAscending() {
        when(sessionRepository.findByIdAndUserId(9, 1)).thenReturn(Optional.of(session(9)));
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc(9))
                .thenReturn(List.of(message(1), message(2)));

        List<AiChatMessage> msgs = service.listMessages(1, 9);

        assertThat(msgs).extracting(AiChatMessage::getId).containsExactly(1, 2);
    }

    @Test
    void listMessagesOthersThrows404() {
        when(sessionRepository.findByIdAndUserId(9, 1)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listMessages(1, 9))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("会话不存在");
    }

    @Test
    void anchorHistoryOwnedReturnsRecentAscending() {
        when(sessionRepository.findByIdAndUserId(9, 1)).thenReturn(Optional.of(session(9)));
        when(messageRepository.findBySessionIdOrderByIdDesc(eq(9), any(Pageable.class)))
                .thenReturn(List.of(message(3), message(2), message(1)));

        List<AiChatMessage> history = service.anchorHistory(1, 9);

        assertThat(history).extracting(AiChatMessage::getId).containsExactly(1, 2, 3);
    }

    @Test
    void anchorHistoryOthersThrows404() {
        when(sessionRepository.findByIdAndUserId(9, 1)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.anchorHistory(1, 9))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("会话不存在");
    }
}
