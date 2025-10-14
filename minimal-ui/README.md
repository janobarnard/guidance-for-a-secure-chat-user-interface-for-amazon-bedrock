# Minimal Amplify AI Conversation UI

This folder contains a lightweight chat UI that embeds the AWS Amplify Gen 2 `AIConversation` component and forwards every prompt to an AgentCore runtime. It is intentionally framework-agnostic so the component can be dropped into the existing React application alongside the current experience.

## Features

- Zero Cloudscape dependencies – styling relies on a few local CSS rules and the Amplify UI base styles.
- Pop-up launcher that can be mounted anywhere in your React tree.
- AgentCore integration using bearer token authentication through the AWS SDK for JavaScript (`client-bedrock-agentcore`).
- Minimal helper utilities (`createAgentCoreClient`, `invokeAgentCore`) for re-use in other components or frameworks.

## Usage

```jsx
import { MinimalChatPopup } from '../minimal-ui';
import '@aws-amplify/ui-react/styles.css';

export default function Example({ token }) {
  return (
    <MinimalChatPopup
      bearerToken={token}
      agentRegion="us-east-1"
      agentRuntimeArn="arn:aws:bedrock-agentcore:us-east-1:821595636116:runtime/beod_agent_dev-uA38cg8hsF"
      headerText="AgentCore Assistant"
      welcomeMessage="Hi there! Ask me anything about your workloads."
    />
  );
}
```

### Authentication expectations

- The UI assumes you already exchanged your user credentials for a bearer token (`bearerToken` prop). The token is injected directly into the AgentCore invocation request using a middleware that strips the default SigV4 headers.
- No other credentials are stored in the browser – the helper constructs a new client whenever the bearer token or region changes.

### Session behaviour

- A fresh AgentCore runtime session identifier is generated when the component mounts. Keeping the component mounted preserves conversation context; unmounting the component (or refreshing the browser) will create a brand-new session.
- Set `welcomeMessage` to `""` if you do not want an automatic assistant greeting.

### Styling

- The CSS file (`minimal-chat-popup.css`) keeps the layout intentionally small and focused. Feel free to override the exported class names to match your host application brand.
- Load the Amplify UI base styles (`@aws-amplify/ui-react/styles.css`) once in your application so that the conversation component inherits the expected tokens and spacing.

### Error handling

- AgentCore responses are decoded from either a streaming payload or a plain JSON string. If the response cannot be parsed, the raw payload is displayed back to the user for easier debugging.
- When the AgentCore client is unavailable the component replies with a short, user-friendly message instead of silently failing.

