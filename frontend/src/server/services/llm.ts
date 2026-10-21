/**
 * Content Engine & Gap Modifier - LLM API clients
 * OpenAI GPT-4o-mini: Drafts GEO blogs & content briefs
 *   Cost: $0.15/1M input | $0.60/1M output
 * Claude 3.5 Haiku: Rewrites content & formats structural tables
 *   Cost: $0.80/1M input | $4.00/1M output
 */

export interface ContentEngineRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: "gpt-4o-mini" | "gpt-4o" | "gpt-4-turbo";
}

export interface ContentEngineResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

export interface GapModifierRequest {
  content: string;
  instruction: string;
  format?: "markdown" | "html" | "json" | "table";
  model?: "claude-3-5-haiku" | "claude-3-5-sonnet";
}

export interface GapModifierResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

export class OpenAIClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY!;
    this.baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  }

  async generate(request: ContentEngineRequest): Promise<ContentEngineResponse> {
    const model = request.model || "gpt-4o-mini";
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: request.systemPrompt || "You are an expert GEO content strategist." },
          { role: "user", content: request.prompt },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const usage = data.usage;
    const cost = this.calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        estimatedCost: cost,
      },
    };
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const rates: Record<string, { input: number; output: number }> = {
      "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
      "gpt-4o": { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
      "gpt-4-turbo": { input: 10.00 / 1_000_000, output: 30.00 / 1_000_000 },
    };
    const rate = rates[model] || rates["gpt-4o-mini"];
    return inputTokens * rate.input + outputTokens * rate.output;
  }
}

export class AnthropicClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY!;
    this.baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";
  }

  async modify(request: GapModifierRequest): Promise<GapModifierResponse> {
    const model = request.model || "claude-3-5-haiku-20241022";
    const systemPrompt = `You are an expert content editor. ${this.getFormatInstruction(request.format)}`;

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [
          { role: "user", content: `Content:\n${request.content}\n\nInstruction: ${request.instruction}` },
        ],
        max_tokens: 8000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const usage = data.usage;
    const cost = this.calculateCost(model, usage.input_tokens, usage.output_tokens);

    return {
      content: data.content[0].text,
      usage: {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
        estimatedCost: cost,
      },
    };
  }

  private getFormatInstruction(format?: string): string {
    switch (format) {
      case "table":
        return "Format output as a clean Markdown table with headers.";
      case "json":
        return "Output only valid JSON. No explanations.";
      case "html":
        return "Output clean, semantic HTML.";
      default:
        return "Output clean Markdown.";
    }
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const rates: Record<string, { input: number; output: number }> = {
      "claude-3-5-haiku-20241022": { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
      "claude-3-5-sonnet-20241022": { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
    };
    const rate = rates[model] || rates["claude-3-5-haiku-20241022"];
    return inputTokens * rate.input + outputTokens * rate.output;
  }
}

let openaiClient: OpenAIClient | null = null;
let anthropicClient: AnthropicClient | null = null;

export function getOpenAIClient(): OpenAIClient {
  if (!openaiClient) openaiClient = new OpenAIClient();
  return openaiClient;
}

export function getAnthropicClient(): AnthropicClient {
  if (!anthropicClient) anthropicClient = new AnthropicClient();
  return anthropicClient;
}

/**
 * Estimate content generation cost
 */
export function estimateContentCost(
  model: "gpt-4o-mini" | "gpt-4o" | "claude-3-5-haiku",
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  const rates: Record<string, { input: number; output: number }> = {
    "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
    "gpt-4o": { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
    "claude-3-5-haiku": { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  };
  const rate = rates[model];
  return estimatedInputTokens * rate.input + estimatedOutputTokens * rate.output;
}