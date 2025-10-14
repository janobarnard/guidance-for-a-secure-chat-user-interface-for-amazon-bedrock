import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';

const readAgentResponse = async (response) => {
  if (!response) {
    return '';
  }

  if (typeof response === 'string') {
    return response;
  }

  if (response instanceof Uint8Array) {
    const decoder = new TextDecoder();
    return decoder.decode(response);
  }

  const reader = response?.getReader?.();

  if (!reader) {
    return '';
  }

  const decoder = new TextDecoder();
  let result = '';
  let done = false;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;

    if (value) {
      result += decoder.decode(value, { stream: !done });
    }
  }

  return result;
};

export const createAgentCoreClient = (bearerToken, region, options = {}) => {
  const client = new BedrockAgentCoreClient({
    region,
    credentials: {
      accessKeyId: 'placeholder',
      secretAccessKey: 'placeholder'
    },
    ...options
  });

  client.middlewareStack.add(
    (next) => async (args) => {
      if (args.request?.headers) {
        args.request.headers = {
          ...args.request.headers,
          Authorization: `Bearer ${bearerToken}`
        };

        delete args.request.headers.authorization;
        delete args.request.headers['x-amz-date'];
        delete args.request.headers['x-amz-security-token'];
      }

      return next(args);
    },
    {
      step: 'finalizeRequest',
      name: 'agentCoreBearerAuthMiddleware',
      priority: 'high'
    }
  );

  return client;
};

export const invokeAgentCore = async (
  client,
  { agentRuntimeArn, runtimeSessionId, prompt }
) => {
  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn,
    runtimeSessionId,
    payload: JSON.stringify({ prompt })
  });

  const { response } = await client.send(command);
  const raw = await readAgentResponse(response);

  if (!raw) {
    return '';
  }

  try {
    const parsed = JSON.parse(raw);

    if (parsed.error) {
      throw new Error(parsed.error.message ?? parsed.error);
    }

    if (parsed.result?.content) {
      return parsed.result.content
        .map((item) => item.text ?? '')
        .join('');
    }

    if (typeof parsed.result === 'string') {
      return parsed.result;
    }

    return raw;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return raw;
    }

    throw error;
  }
};
