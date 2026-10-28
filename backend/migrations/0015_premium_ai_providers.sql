INSERT INTO ai_providers(id,display_name) VALUES
  ('serpapi_google','SerpApi Google AI Mode / AI Overview'),
  ('gemini_search','Gemini Search'),
  ('openai_responses_api','OpenAI Responses API (model response evaluation)'),
  ('anthropic_claude','Anthropic Claude (model response evaluation)'),
  ('perplexity','Perplexity (model response evaluation)')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_provider_capabilities(provider_id,engine,surface,country,language) VALUES
  ('serpapi_google','Google','google_ai_overview','US','en'),
  ('serpapi_google','Google','google_ai_overview','GB','en'),
  ('serpapi_google','Google','google_ai_overview','CA','en'),
  ('serpapi_google','Google','google_ai_overview','AU','en'),
  ('serpapi_google','Google','google_ai_mode','US','en'),
  ('serpapi_google','Google','google_ai_mode','GB','en'),
  ('serpapi_google','Google','google_ai_mode','CA','en'),
  ('serpapi_google','Google','google_ai_mode','AU','en')
ON CONFLICT DO NOTHING;

INSERT INTO ai_provider_capabilities(provider_id,engine,surface,country,language) VALUES
  ('gemini_search','Gemini','gemini_search','US','en'),
  ('gemini_search','Gemini','gemini_search','GB','en'),
  ('gemini_search','Gemini','gemini_search','CA','en'),
  ('gemini_search','Gemini','gemini_search','AU','en')
ON CONFLICT DO NOTHING;

INSERT INTO ai_provider_capabilities(provider_id,engine,surface,country,language) VALUES
  ('openai_responses_api','GPT','model_response','US','en')
ON CONFLICT DO NOTHING;

INSERT INTO ai_provider_capabilities(provider_id,engine,surface,country,language) VALUES
  ('anthropic_claude','Claude','model_response','US','en')
ON CONFLICT DO NOTHING;

INSERT INTO ai_provider_capabilities(provider_id,engine,surface,country,language) VALUES
  ('perplexity','Perplexity','model_response','US','en')
ON CONFLICT DO NOTHING;
