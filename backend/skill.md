# Chatbot Admin Backend Skill

## Purpose
This backend powers the admin-side chatbot operations for the site assistant.
It is responsible for:

- managing prompt templates used by the assistant
- exposing assistant conversation logs for review
- running prompt test requests with live or draft prompt content
- keeping prompt version metadata and assistant usage logs consistent
- rebuilding the knowledge base that the assistant uses for retrieval

## Scope
This skill covers the chatbot admin backend only.
It does not cover the public-facing site UI except where the backend behavior affects it.

## Core Data Flow

1. Prompt templates are stored in `prompt_templates`.
2. The assistant loads the active prompt pack through `load_prompt_pack()`.
3. The assistant retrieves matching knowledge cards from the synced `skill_cards` / `knowledge_items`.
4. Assistant calls are logged into `assistant_conversation_sessions` and `assistant_conversation_turns`.
5. Admin pages can inspect those logs or test a prompt draft without saving it.

## Main Backend Responsibilities

### 1. Prompt Management

Admin can:

- list all prompts
- view a single prompt by `prompt_key`
- update a prompt draft
- reset a prompt back to its default content

Important behavior:

- saving a prompt increments `version`
- disabling a prompt excludes it from the active prompt pack
- default prompt content lives in `backend/app/assistant.py` under `DEFAULT_PROMPTS`

Relevant endpoints:

- `GET /api/admin/prompts`
- `GET /api/admin/prompts/{prompt_key}`
- `PUT /api/admin/prompts/{prompt_key}`
- `POST /api/admin/prompts/{prompt_key}/reset`

### 2. Prompt Test Runner

Admin can run a test request using:

- a live question
- optional chat history
- prompt overrides supplied only for the test run

The test runner should:

- use the same retrieval and answer generation path as the real assistant
- support non-streaming and streaming responses
- return `answer`, `show_sources`, `selected_skills`, `related_links`
- return model and usage metadata such as latency and token counts
- include `prompt_versions` so the admin can verify which versions were used

Relevant endpoints:

- `POST /api/admin/prompts/test`
- `POST /api/admin/prompts/test/stream`

Implementation notes:

- prompt overrides are passed as in-memory prompt content only
- overrides are not persisted unless the admin explicitly saves them through the normal prompt update endpoint
- the streaming test runner emits NDJSON events:
  - `text_delta`
  - `meta`
  - `done`

### 3. Assistant Conversation Logs

Admin can inspect and delete conversation history.

Available data:

- session title
- first and last question
- answer preview
- model name
- latency
- token usage
- prompt versions used by the last turn
- each turn's question, answer, selected skills, related links, and history context

Relevant endpoints:

- `GET /api/admin/assistant/conversations`
- `GET /api/admin/assistant/conversations/{session_id}`
- `DELETE /api/admin/assistant/conversations/{session_id}`

### 4. Knowledge Base Sync

The assistant depends on a synced knowledge base built from:

- profile data
- blog posts

The sync step rebuilds:

- `knowledge_items`
- `skill_cards`

Relevant endpoint:

- `POST /api/admin/assistant/sync`

Important behavior:

- prompt changes do not require a knowledge sync
- profile or blog changes may require syncing to refresh assistant retrieval output

## Assistant Runtime Rules

When changing chatbot backend logic, keep these rules stable:

- use `load_prompt_pack()` for normal assistant requests
- preserve prompt version tracking in conversation logs
- keep `selected_skills` and `related_links` consistent between normal asks, streaming asks, and admin test runs
- keep `show_sources` logic aligned with the source visibility prompt
- keep fallback behavior working when OpenAI is unavailable
- do not persist admin test runner prompt overrides

## Data Models To Know

- `PromptTemplate`
- `AssistantConversationSession`
- `AssistantConversationTurn`
- `SkillCard`
- `KnowledgeItem`

## Files Of Interest

- [`backend/app/main.py`](./app/main.py)
- [`backend/app/assistant.py`](./app/assistant.py)
- [`backend/app/models.py`](./app/models.py)
- [`backend/app/schemas.py`](./app/schemas.py)
- [`backend/app/seed.py`](./app/seed.py)

## Maintenance Checklist

Before changing chatbot admin behavior, check:

- whether the change affects prompt version tracking
- whether logs should store new metadata
- whether the streaming and non-streaming paths still match
- whether default prompt content needs to be updated
- whether the frontend admin pages need a matching API update

