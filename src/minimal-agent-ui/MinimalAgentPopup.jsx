import { useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import { AIConversation } from '@aws-amplify/ui-react-ai';
import '@aws-amplify/ui-react/styles.css';
import '@aws-amplify/ui-react-ai/ai-conversation-styles.css';
import './MinimalAgentPopup.css';

const createMessage = (role, text) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  role,
  content: [{ text }],
  createdAt: new Date().toISOString(),
});

const decodeAgentCorePayload = async (agentResponse) => {
  const stream = agentResponse?.response;
  if (!stream) {
    return '';
  }

  if (typeof stream === 'string') {
    return stream;
  }

  if (stream instanceof Uint8Array) {
    return new TextDecoder().decode(stream);
  }

  if (typeof stream.text === 'function') {
    return stream.text();
  }

  if (typeof stream.transformToString === 'function') {
    return stream.transformToString();
  }

  if (typeof stream.arrayBuffer === 'function') {
    const buffer = await stream.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }

  if (typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = '';
    let done = false;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) {
        result += decoder.decode(value, { stream: !done });
      }
    }

    return result;
  }

  return '';
};

const extractAgentText = (rawBody) => {
  if (!rawBody) {
    return 'The agent did not return any content.';
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (Array.isArray(parsed?.result?.content)) {
      const text = parsed.result.content
        .map((item) => (typeof item.text === 'string' ? item.text : item.text?.text))
        .filter(Boolean)
        .join('')
        .trim();

      if (text) {
        return text;
      }
    }

    if (typeof parsed?.result === 'string' && parsed.result.trim()) {
      return parsed.result.trim();
    }

    return rawBody;
  } catch {
    return rawBody;
  }
};

const createSessionIdentifier = () =>
  `agentcore-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const MinimalAgentPopup = ({
  agentArn,
  agentRegion,
  bearerToken,
  conversationName = 'Agent',
  userDisplayName = 'You',
  welcomeMessage = 'How can I help you today?',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const sessionIdRef = useRef(createSessionIdentifier());

  const agentClient = useMemo(() => {
    if (!agentRegion || !bearerToken) {
      return null;
    }

    const client = new BedrockAgentCoreClient({
      region: agentRegion,
      credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
      },
    });

    client.middlewareStack.add(
      (next) => async (args) => {
        args.request.headers = {
          ...args.request.headers,
          Authorization: `Bearer ${bearerToken}`,
        };
        delete args.request.headers.authorization;
        delete args.request.headers['x-amz-date'];
        delete args.request.headers['x-amz-security-token'];
        return next(args);
      },
      { step: 'finalizeRequest', name: 'agentcoreBearerToken', priority: 'high' },
    );

    return client;
  }, [agentRegion, bearerToken]);

  const handleSendMessage = useCallback(
    async ({ content }) => {
      const textParts = (content ?? [])
        .map((part) => {
          if (typeof part.text === 'string') {
            return part.text;
          }
          if (part?.text && typeof part.text?.text === 'string') {
            return part.text.text;
          }
          return '';
        })
        .filter((part) => part.trim().length > 0);

      const prompt = textParts.join('\n').trim();

      if (!prompt) {
        return;
      }

      const userMessage = createMessage('user', prompt);
      setMessages((prev) => [...prev, userMessage]);

      if (!agentClient || !agentArn) {
        setMessages((prev) => [
          ...prev,
          createMessage(
            'assistant',
            'The agent is not configured. Please verify the ARN, region, and authentication token.',
          ),
        ]);
        return;
      }

      setIsLoading(true);

      try {
        const runtimeSessionId = sessionIdRef.current;
        const payload = JSON.stringify({ prompt });
        const command = new InvokeAgentRuntimeCommand({
          agentRuntimeArn: agentArn,
          runtimeSessionId,
          contentType: 'application/json',
          accept: 'application/json',
          payload: new TextEncoder().encode(payload),
        });

        const response = await agentClient.send(command);
        if (response.runtimeSessionId) {
          sessionIdRef.current = response.runtimeSessionId;
        }

        const rawBody = await decodeAgentCorePayload(response);
        const agentText = extractAgentText(rawBody);

        setMessages((prev) => [...prev, createMessage('assistant', agentText)]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setMessages((prev) => [
          ...prev,
          createMessage('assistant', `Sorry, something went wrong: ${errorMessage}`),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [agentArn, agentClient],
  );

  return (
    <div className="minimal-agent-popup">
      <button
        type="button"
        className="minimal-agent-popup__toggle"
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? 'Close chat' : 'Chat'}
      </button>

      {isOpen && (
        <div className="minimal-agent-popup__panel" role="dialog" aria-label={`${conversationName} chat`}>
          <div className="minimal-agent-popup__panel-header">
            <span className="minimal-agent-popup__panel-title">{conversationName}</span>
            <button
              type="button"
              className="minimal-agent-popup__close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
          <div className="minimal-agent-popup__conversation">
            <AIConversation
              messages={messages}
              handleSendMessage={handleSendMessage}
              isLoading={isLoading}
              avatars={{
                ai: { username: conversationName },
                user: { username: userDisplayName },
              }}
              welcomeMessage={<div className="minimal-agent-popup__welcome">{welcomeMessage}</div>}
            />
          </div>
        </div>
      )}
    </div>
  );
};

MinimalAgentPopup.propTypes = {
  agentArn: PropTypes.string.isRequired,
  agentRegion: PropTypes.string.isRequired,
  bearerToken: PropTypes.string.isRequired,
  conversationName: PropTypes.string,
  userDisplayName: PropTypes.string,
  welcomeMessage: PropTypes.string,
};

export default MinimalAgentPopup;
