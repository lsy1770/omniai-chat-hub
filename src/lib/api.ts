import type { Message } from '../types';

interface StreamOptions {
  url: string;
  apiKey: string;
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  signal?: AbortSignal; // <--- AbortSignal support
  onToken: (token: string) => void;
  onComplete?: () => void;
  onError?: (err: Error) => void;
}

export interface ModelResponse {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

// ==============================================================================
// 1. 定义全局请求拦截器 (The Interceptor)
// ==============================================================================
async function apiFetch(url: string, options: RequestInit = {}, apiKey?: string): Promise<Response> {
  // 1. 初始化 Headers
  const headers = new Headers(options.headers || {});

  // 2. 拦截逻辑：自动注入 Authorization
  if (apiKey) {
    // 只有当没有手动设置 Authorization 时才注入，防止覆盖特殊需求
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${apiKey}`);
    }
  }

  // 3. 自动注入 Content-Type (如果是 POST/PUT 且未设置)
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET' && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  // 4. 发起请求
  const response = await fetch(url, {
    ...options,
    headers, // 使用处理过的 headers
  });

  // 5. (可选) 全局错误状态拦截
  if (!response.ok) {
    const errText = await response.text();
    // 抛出统一格式的错误，方便上层捕获
    throw new Error(`API Request Failed (${response.status}): ${errText}`);
  }

  return response;
}

// ==============================================================================
// 2. 业务 API 方法 (使用拦截器)
// ==============================================================================

/**
 * 获取所有可用模型 (GET /v1/models)
 */
export async function fetchModels(baseUrl: string, apiKey: string): Promise<ModelResponse[]> {
  let modelsUrl = '';
  if (baseUrl.includes('/chat/completions')) {
    modelsUrl = baseUrl.replace('/chat/completions', '/models');
  } else {
    modelsUrl = `${baseUrl.replace(/\/+$/, '')}/v1/models`;
  }

  try {
    // 使用拦截器 apiFetch，不再手动写 headers
    const response = await apiFetch(modelsUrl, { method: 'GET' }, apiKey);
    
    const data = await response.json();
    return Array.isArray(data) ? data : (data.data || []);
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}




/**
 * 格式化多模态消息
 */
const formatMessageForAPI = (msg: { role: string; content: string; attachments?: string[] }) => {
  if (!msg.attachments || msg.attachments.length === 0) {
    return { role: msg.role, content: msg.content };
  }
  return {
    role: msg.role,
    content: [
      { type: 'text', text: msg.content || ' ' },
      ...msg.attachments.map(url => ({
        type: 'image_url',
        image_url: { url: url, detail: 'auto' }
      }))
    ]
  };
};

/**
 * 统一 Chat Completions (POST /v1/chat/completions)
 */
export async function streamCompletion({
  url,
  apiKey,
  model,
  messages,
  temperature = 0.7,
  max_tokens,
  onToken,
  onComplete,
  onError,
  signal, // <--- 接收 signal
}: StreamOptions) {
  try {
    const apiMessages = messages.map(formatMessageForAPI);

    const body: any = {
      model,
      messages: apiMessages,
      stream: true,
      temperature,
    };

    if (max_tokens) body.max_tokens = max_tokens;

    // 传递 signal 给 apiFetch
    const response = await apiFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      signal, // <--- 传递
    }, apiKey);

    if (!response.body) throw new Error('ReadableStream not supported');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') continue;
        try {
          const json = JSON.parse(dataStr);

          // 【调试】记录实际接收到的数据格式（仅在开发环境）
          if (import.meta.env.DEV) {
            console.log('[SSE Debug] Received JSON:', json);
          }

          // 兼容多种格式:
          // 1. OpenAI Chat Completions: {"choices":[{"delta":{"content":"..."}}]}
          // 2. Codex API: {"type":"response.output_text.delta","delta":"文本"}
          // 3. Claude API: {"type":"content_block_delta","delta":{"type":"text_delta","text":"文本"}}
          // 4. 代理统一格式: {"content":"..."}
          let content = '';

          // OpenAI 格式（包括代理转换后的Claude流式响应）
          if (json.choices?.[0]?.delta?.content !== undefined) {
            const deltaContent = json.choices[0].delta.content;
            // 确保content是字符串且非空
            if (typeof deltaContent === 'string') {
              content = deltaContent;
            }
          }
          // Codex 格式 (response.output_text.delta 事件)
          else if (json.type === 'response.output_text.delta' && json.delta) {
            content = typeof json.delta === 'string' ? json.delta : '';
          }
          // Claude 原生格式 (content_block_delta 事件)
          else if (json.type === 'content_block_delta' && json.delta?.text) {
            content = json.delta.text;
          }
          // 代理统一格式（直接包含content字段）
          else if (json.content && typeof json.content === 'string') {
            content = json.content;
          }

          // 只有当content是非空字符串时才调用onToken
          if (content && typeof content === 'string' && content.length > 0) {
            onToken(content);
          } else if (import.meta.env.DEV && json.type !== 'ping' && json.choices && json.choices.length > 0) {
            // 调试：记录没有提取到content的情况（排除ping事件）
            console.log('[SSE Debug] No content extracted from:', json);
          }
        } catch (parseError) {
          // JSON解析错误 - 记录但继续处理后续数据
          const err = parseError instanceof Error ? parseError : new Error(String(parseError));
          console.warn('Failed to parse SSE data chunk:', dataStr, err.message);
          // 不中断流，继续处理下一个chunk
        }
      }
    }

    if (onComplete) onComplete();

  } catch (error: unknown) {
    // 【关键】如果是用户手动取消，视为"完成"而不是错误
    const err = error instanceof Error ? error : new Error(String(error));

    if (err.name === 'AbortError') {
      console.log('Generation stopped by user');
      if (onComplete) onComplete();
      return;
    }

    console.error('Stream error:', err);
    if (onError) onError(err);
  }
}

export interface ImageGenerationOptions {
  url: string;
  apiKey: string;
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  quality?: string;
  background?: string;
  output_format?: 'png' | 'jpeg' | 'webp';
  output_compression?: number;
  signal?: AbortSignal;
}

export interface ImageEditOptions extends Omit<ImageGenerationOptions, 'n'> {
  image: File;
  mask?: File;
  n?: number;
}

export interface OpenAIImageResult {
  src: string;
  revisedPrompt?: string;
}

interface OpenAIImagesResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
}

function resolveImagesEndpoint(baseUrl: string, action: 'generations' | 'edits') {
  const endpoint = `/images/${action}`;
  const fallback = `/openai/v1${endpoint}`;
  const trimmed = baseUrl.trim();

  if (!trimmed) return fallback;

  try {
    const url = new URL(trimmed, window.location.origin);
    const isRelative = trimmed.startsWith('/');
    const isOpenAIDirect = /(^|\.)openai\.com$/i.test(url.hostname);

    if ((isRelative || !isOpenAIDirect) && url.pathname === '/v1/chat/completions') {
      url.pathname = `/openai/v1${endpoint}`;
      return isRelative ? `${url.pathname}${url.search}` : url.toString();
    }

    if (url.pathname.includes('/chat/completions')) {
      url.pathname = url.pathname.replace(/\/chat\/completions\/?$/, endpoint);
      return isRelative ? `${url.pathname}${url.search}` : url.toString();
    }

    if (url.pathname.endsWith('/v1')) {
      url.pathname = `${url.pathname}${endpoint}`;
      return isRelative ? `${url.pathname}${url.search}` : url.toString();
    }

    url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1${endpoint}`;
    return isRelative ? `${url.pathname}${url.search}` : url.toString();
  } catch {
    return fallback;
  }
}

function normalizeImageResults(payload: OpenAIImagesResponse, outputFormat = 'png'): OpenAIImageResult[] {
  const mime = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png';

  return (payload.data || []).reduce<OpenAIImageResult[]>((items, item) => {
    const src = item.b64_json ? `data:${mime};base64,${item.b64_json}` : item.url;
    if (!src) return items;

    items.push({
      src,
      ...(item.revised_prompt ? { revisedPrompt: item.revised_prompt } : {}),
    });
    return items;
  }, []);
}

export async function generateOpenAIImage(options: ImageGenerationOptions): Promise<OpenAIImageResult[]> {
  const body: Record<string, unknown> = {
    model: options.model,
    prompt: options.prompt,
    n: options.n || 1,
    response_format: 'b64_json',
  };

  if (options.size) body.size = options.size;
  if (options.quality) body.quality = options.quality;
  if (options.background) body.background = options.background;
  if (options.output_format) body.output_format = options.output_format;
  if (options.output_compression) body.output_compression = options.output_compression;

  const response = await apiFetch(resolveImagesEndpoint(options.url, 'generations'), {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options.signal,
  }, options.apiKey);

  const payload = await response.json();
  const results = normalizeImageResults(payload, options.output_format || 'png');
  if (results.length === 0) {
    throw new Error('Images API returned no images');
  }
  return results;
}

export async function editOpenAIImage(options: ImageEditOptions): Promise<OpenAIImageResult[]> {
  const form = new FormData();
  form.append('model', options.model);
  form.append('prompt', options.prompt);
  form.append('n', String(options.n || 1));
  form.append('response_format', 'b64_json');
  form.append('image', options.image);

  if (options.mask) form.append('mask', options.mask);
  if (options.size) form.append('size', options.size);
  if (options.quality) form.append('quality', options.quality);
  if (options.background) form.append('background', options.background);
  if (options.output_format) form.append('output_format', options.output_format);
  if (options.output_compression) form.append('output_compression', String(options.output_compression));

  const response = await apiFetch(resolveImagesEndpoint(options.url, 'edits'), {
    method: 'POST',
    body: form,
    signal: options.signal,
  }, options.apiKey);

  const payload = await response.json();
  const results = normalizeImageResults(payload, options.output_format || 'png');
  if (results.length === 0) {
    throw new Error('Images API returned no edited images');
  }
  return results;
}
