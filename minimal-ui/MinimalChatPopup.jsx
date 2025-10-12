import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { AIConversation } from '@aws-amplify/ui-react-ai';
import '@aws-amplify/ui-react/styles.css';

import { createAgentCoreClient, invokeAgentCore } from './agentCoreClient.js';
import './minimal-chat-popup.css';

const createTextMessage = (role, text, metadata) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  createdAt: new Date().toISOString(),
  content: [
    {
      text: {
        text
      }
    }
  ],
  metadata
});

const buildWelcomeMessages = (welcomeMessage) => {
  if (!welcomeMessage) {
    return [];
  }

  return [
    createTextMessage('assistant', welcomeMessage, { isWelcome: true })
  ];
};

const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `agentcore-${crypto.randomUUID()}`;
  }

  return `agentcore-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const MinimalChatPopup = ({
  bearerToken,
  agentRuntimeArn,
  agentRegion,
  headerText = 'Agent Assistant',
  welcomeMessage = 'How can I help you today?',
  className
}) => {
  const [client, setClient] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState(() => buildWelcomeMessages(welcomeMessage));

  const runtimeSessionId = useMemo(() => generateSessionId(), []);

  useEffect(() => {
    setMessages((previousMessages) => {
      const initialMessages = buildWelcomeMessages(welcomeMessage);

      const onlyContainsWelcome = previousMessages.every((message) => message.metadata?.isWelcome);

      if (!initialMessages.length) {
        return onlyContainsWelcome ? [] : previousMessages;
      }

      if (previousMessages.length === 0 || onlyContainsWelcome) {
        return initialMessages;
      }

      return previousMessages;
    });
  }, [welcomeMessage]);

  useEffect(() => {
    if (!bearerToken || !agentRegion) {
      setClient(null);
      return undefined;
    }

    const newClient = createAgentCoreClient(bearerToken, agentRegion);
    setClient(newClient);

    return () => {
      if (typeof newClient.destroy === 'function') {
        newClient.destroy();
      }
    };
  }, [bearerToken, agentRegion]);

  const appendAssistantMessage = useCallback((text) => {
    setMessages((previous) => [
      ...previous,
      createTextMessage('assistant', text)
    ]);
  }, []);

  const handleSendMessage = useCallback(
    async ({ content }) => {
      const textBlock = content.find((item) => item.text)?.text?.text ?? '';
      const prompt = textBlock.trim();

      if (!prompt) {
        return;
      }

      const userMessage = createTextMessage('user', prompt);
      setMessages((previous) => [...previous, userMessage]);

      if (!client || !agentRuntimeArn) {
        appendAssistantMessage('The agent is unavailable right now.');
        return;
      }

      setIsLoading(true);

      try {
        const agentResponse = await invokeAgentCore(client, {
          agentRuntimeArn,
          runtimeSessionId,
          prompt
        });

        const cleanedResponse = agentResponse?.trim?.() ? agentResponse.trim() : 'I was unable to process that request.';
        appendAssistantMessage(cleanedResponse);
      } catch (error) {
        console.error('MinimalChatPopup invocation error:', error);
        const message = error instanceof Error ? error.message : String(error);
        appendAssistantMessage(`Something went wrong. ${message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [appendAssistantMessage, client, agentRuntimeArn, runtimeSessionId]
  );

  return (
    <div className={`minimal-chat ${className ?? ''}`}>
      <button
        type="button"
        className="minimal-chat__toggle"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
      >
        {isOpen ? 'Close chat' : 'Open chat'}
      </button>

      {isOpen && (
        <div className="minimal-chat__window" role="dialog" aria-label={headerText}>
          <header className="minimal-chat__header">
            <span>{headerText}</span>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chat window">
              ×
            </button>
          </header>

          <div className="minimal-chat__body">
            <AIConversation
              messages={messages}
              handleSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

MinimalChatPopup.propTypes = {
  bearerToken: PropTypes.string.isRequired,
  agentRuntimeArn: PropTypes.string.isRequired,
  agentRegion: PropTypes.string.isRequired,
  headerText: PropTypes.string,
  welcomeMessage: PropTypes.string,
  className: PropTypes.string
};

export default MinimalChatPopup;
