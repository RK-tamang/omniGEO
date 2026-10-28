import { NextResponse } from "next/server";

const providers = [
  { id: "dataforseo_chatgpt_search", display_name: "ChatGPT Search (DataForSEO)", enabled: true, max_concurrency: 10, max_requests_per_minute: 60 },
  { id: "openai_responses_api", display_name: "OpenAI Responses API", enabled: true, max_concurrency: 5, max_requests_per_minute: 30 },
  { id: "gemini_search", display_name: "Gemini Search", enabled: true, max_concurrency: 10, max_requests_per_minute: 60 },
  { id: "anthropic_claude", display_name: "Anthropic Claude", enabled: true, max_concurrency: 8, max_requests_per_minute: 40 },
  { id: "perplexity", display_name: "Perplexity", enabled: false, max_concurrency: 5, max_requests_per_minute: 30 },
];

export async function GET() {
  return NextResponse.json({ providers });
}
