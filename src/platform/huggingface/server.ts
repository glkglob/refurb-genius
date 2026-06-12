/**
 * Platform boundary — Hugging Face (server-only).
 *
 * There is intentionally no browser entry for this vendor: the SDK and API key
 * must never reach the client bundle. Import this module only from
 * `*.server.ts` files or via dynamic `import()` inside `createServerFn` handlers.
 *
 * Supports both:
 * - HF Inference API (serverless, pay-per-token) via @huggingface/inference
 * - Local/self-hosted inference via text-generation-inference (TGI) or vLLM
 */
import { HfInference } from "@huggingface/inference";

export type { HfInference };

// Minimal types for HF chat completion (mirroring @huggingface/tasks)
type ChatCompletionInputMessageChunkType = "text" | "image_url";

interface ChatCompletionInputURL {
  url: string;
  [property: string]: unknown;
}

interface ChatCompletionInputMessageChunk {
  type: ChatCompletionInputMessageChunkType;
  text?: string;
  image_url?: ChatCompletionInputURL;
  [property: string]: unknown;
}

type ChatCompletionInputMessageContent = ChatCompletionInputMessageChunk[] | string;

interface ChatCompletionInputMessage {
  role: string;
  content?: ChatCompletionInputMessageContent;
  name?: string;
  tool_calls?: unknown[];
  [property: string]: unknown;
}

export interface HuggingFaceConfig {
  /** API token for HF Inference API (optional if using self-hosted) */
  apiKey?: string;
  /** Base URL for self-hosted TGI/vLLM endpoint (e.g., "http://localhost:8080") */
  baseUrl?: string;
  /** Default model to use for vision tasks */
  defaultVisionModel?: string;
  /** Default model to use for text tasks */
  defaultTextModel?: string;
  /** Timeout for requests in ms */
  timeoutMs?: number;
}

/** Default vision-capable models on HF Inference API */
export const VISION_MODELS = {
  /** Llama 3.2 Vision 11B - strong general vision, good for property photos */
  LLAMA_3_2_11B: "meta-llama/Llama-3.2-11B-Vision-Instruct",
  /** Llama 3.2 Vision 90B - best quality, slower */
  LLAMA_3_2_90B: "meta-llama/Llama-3.2-90B-Vision-Instruct",
  /** Qwen2-VL 7B - strong multilingual + vision */
  QWEN2_VL_7B: "Qwen/Qwen2-VL-7B-Instruct",
  /** Pixtral 12B - strong vision from Mistral */
  PIXTRAL_12B: "mistralai/Pixtral-12B-2409",
  /** SmolVLM - lightweight, fast */
  SMOLVLM: "HuggingFaceTB/SmolVLM-Instruct",
} as const;

/** Default text-only models for scope/estimate generation */
export const TEXT_MODELS = {
  LLAMA_3_1_8B: "meta-llama/Meta-Llama-3.1-8B-Instruct",
  LLAMA_3_1_70B: "meta-llama/Meta-Llama-3.1-70B-Instruct",
  QWEN2_5_7B: "Qwen/Qwen2.5-7B-Instruct",
  QWEN2_5_72B: "Qwen/Qwen2.5-72B-Instruct",
  MISTRAL_NEMO: "mistralai/Mistral-Nemo-Instruct-2407",
} as const;

export type VisionModelId = (typeof VISION_MODELS)[keyof typeof VISION_MODELS];
export type TextModelId = (typeof TEXT_MODELS)[keyof typeof TEXT_MODELS];

let visionClient: HfInference | null = null;
const textClient: HfInference | null = null;
let currentConfig: HuggingFaceConfig | null = null;

/**
 * Get or create the HuggingFace Inference client for vision tasks.
 * Uses singleton pattern - assumes single config for app lifetime.
 */
export function getHuggingFaceVisionClient(config: HuggingFaceConfig): HfInference {
  if (!visionClient || currentConfig?.baseUrl !== config.baseUrl) {
    const apiKey = config.apiKey ?? process.env.HUGGINGFACE_API_KEY;
    const baseUrl = config.baseUrl ?? process.env.HUGGINGFACE_ENDPOINT_URL;

    // @huggingface/inference uses `endpointUrl` for custom endpoints
    visionClient = new HfInference(apiKey, { endpointUrl: baseUrl });
    currentConfig = { ...config, baseUrl };
  }

  return visionClient;
}

/**
 * Get or create the HuggingFace Inference client for text tasks.
 */
export function getHuggingFaceTextClient(config: HuggingFaceConfig): HfInference {
  // For now, reuse vision client since HF Inference client is generic
  // In future, could separate if different endpoints/models needed
  return getHuggingFaceVisionClient(config);
}

/**
 * Generate a chat completion with vision model via HF Inference API.
 *
 * @param config - HF configuration
 * @param model - Model ID (from VISION_MODELS or custom)
 * @param messages - Chat messages + images (OpenAI-compatible format)
 * @param options - Generation options
 * @returns Generated text content
 */
export async function hfVisionChatCompletion(
  config: HuggingFaceConfig,
  model: VisionModelId | string,
  messages: Array<{
    role: "system" | "user" | "assistant";
    content:
      | string
      | Array<{
          type: ChatCompletionInputMessageChunkType;
          text?: string;
          image_url?: { url: string; detail?: "low" | "high" };
        }>;
  }>,
  options?: {
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: "json_object" };
    timeoutMs?: number;
  },
): Promise<string> {
  const client = getHuggingFaceVisionClient(config);

  // Convert OpenAI-format messages to HF chat completion format
  // HF Inference API expects messages array with content as string or multimodal
  const hfMessages = messages.map((msg) => {
    if (typeof msg.content === "string") {
      return { role: msg.role, content: msg.content };
    }
    // Multimodal: convert image_url to HF format
    const content = msg.content.map((part) => {
      if (part.type === "text") {
        return { type: part.type, text: part.text ?? "" };
      }
      if (part.type === "image_url" && part.image_url) {
        return {
          type: part.type,
          image_url: { url: part.image_url.url },
        };
      }
      return { type: "text" as ChatCompletionInputMessageChunkType, text: "" };
    });
    return { role: msg.role, content };
  });

  const timeoutMs = options?.timeoutMs ?? config.timeoutMs ?? 60_000;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.chatCompletion({
      model,
      messages: hfMessages,
      max_tokens: options?.maxTokens ?? 512,
      temperature: options?.temperature ?? 0.1,
      response_format: options?.responseFormat,
    });

    clearTimeout(timeoutId);

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from HuggingFace");

    return typeof content === "string" ? content : JSON.stringify(content);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`HF request timeout after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/**
 * Generate a text completion via HF Inference API (for scope/estimate generation).
 */
export async function hfTextCompletion(
  config: HuggingFaceConfig,
  model: TextModelId | string,
  prompt: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: "json_object" };
    timeoutMs?: number;
  },
): Promise<string> {
  const client = getHuggingFaceTextClient(config);

  const timeoutMs = options?.timeoutMs ?? config.timeoutMs ?? 60_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Use text-generation endpoint for simpler completion
    const response = await client.textGeneration({
      model,
      inputs: prompt,
      parameters: {
        max_new_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.1,
        return_full_text: false,
      },
    });

    clearTimeout(timeoutId);
    return response.generated_text ?? "";
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`HF request timeout after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/**
 * Get the effective config from environment with sensible defaults.
 */
export function getHuggingFaceConfig(): HuggingFaceConfig {
  const timeoutEnv = process.env.HF_TIMEOUT_MS;
  const parsedTimeout = timeoutEnv ? Number(timeoutEnv) : NaN;
  return {
    apiKey: process.env.HUGGINGFACE_API_KEY,
    baseUrl: process.env.HUGGINGFACE_ENDPOINT_URL,
    defaultVisionModel:
      (process.env.HF_VISION_MODEL as VisionModelId) ?? VISION_MODELS.LLAMA_3_2_11B,
    defaultTextModel: (process.env.HF_TEXT_MODEL as TextModelId) ?? TEXT_MODELS.LLAMA_3_1_8B,
    timeoutMs: Number.isFinite(parsedTimeout) ? parsedTimeout : 60_000,
  };
}

/**
 * Check if HuggingFace is configured and available.
 */
export function isHuggingFaceConfigured(): boolean {
  const config = getHuggingFaceConfig();
  return Boolean(config.apiKey || config.baseUrl);
}
