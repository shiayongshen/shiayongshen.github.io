import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "../components/Seo";
import { api } from "../lib/api";
import type { PromptTemplate, PromptTemplateInput } from "../lib/types";

const MAX_PROMPT_TITLE_LENGTH = 120;
const MAX_PROMPT_DESCRIPTION_LENGTH = 2000;
const MAX_PROMPT_CONTENT_LENGTH = 12000;

type AdminPromptsPageProps = {
  token: string;
};

const PROMPT_LABELS: Record<string, string> = {
  answer_system_prompt: "Answer Prompt",
  skill_selection_prompt: "Skill Selection Prompt",
  source_visibility_prompt: "Source Visibility Prompt",
};

function emptyDraft(prompt: PromptTemplate | null): PromptTemplateInput {
  return {
    title: prompt?.title ?? "",
    description: prompt?.description ?? "",
    content: prompt?.content ?? "",
    enabled: prompt?.enabled ?? true,
  };
}

export function AdminPromptsPage({ token }: AdminPromptsPageProps) {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [activePromptKey, setActivePromptKey] = useState("");
  const [draft, setDraft] = useState<PromptTemplateInput>(emptyDraft(null));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activePrompt = useMemo(
    () => prompts.find((item) => item.prompt_key === activePromptKey) ?? null,
    [prompts, activePromptKey],
  );

  async function loadPrompts(nextActiveKey?: string) {
    setLoading(true);
    setError("");
    try {
      const data = await api.adminGetPrompts(token);
      setPrompts(data);
      const selectedKey = nextActiveKey && data.some((item) => item.prompt_key === nextActiveKey) ? nextActiveKey : data[0]?.prompt_key ?? "";
      setActivePromptKey(selectedKey);
      const selectedPrompt = data.find((item) => item.prompt_key === selectedKey) ?? null;
      setDraft(emptyDraft(selectedPrompt));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load prompts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrompts().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setDraft(emptyDraft(activePrompt));
  }, [activePrompt]);

  function handleSelect(promptKey: string) {
    setActivePromptKey(promptKey);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePromptKey) return;
    setSaving(true);
    setError("");
    try {
      await api.adminUpdatePrompt(token, activePromptKey, draft);
      await loadPrompts(activePromptKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save prompt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!activePromptKey) return;
    setSaving(true);
    setError("");
    try {
      await api.adminResetPrompt(token, activePromptKey);
      await loadPrompts(activePromptKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset prompt.");
    } finally {
      setSaving(false);
    }
  }

  const activeLabel = activePrompt ? PROMPT_LABELS[activePrompt.prompt_key] ?? activePrompt.prompt_key : "Select a prompt";

  return (
    <section className="stack admin-prompts-page">
      <Seo
        title="Prompt Management | Vincent Hsia"
        description="Admin dashboard for editing assistant prompt templates."
        path="/admin/prompts"
        robots="noindex,nofollow"
      />

      <div className="section-header">
        <div>
          <p className="eyebrow">Prompt Management</p>
          <h1>Prompts</h1>
          <p className="muted">Edit the assistant system prompts used for response generation, card selection, and source visibility.</p>
        </div>
        <div className="action-row">
          <button className="text-button" type="button" onClick={() => navigate("/admin/prompts/test")}>
            Open Prompt Runner
          </button>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="admin-prompts-layout">
        <aside className="panel admin-prompts-list">
          <div className="section-header">
            <div>
              <p className="eyebrow">Templates</p>
              <h2>Available Prompts</h2>
            </div>
            <button className="primary-button" type="button" onClick={() => loadPrompts(activePromptKey).catch(console.error)} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="admin-prompt-card-list">
            {prompts.map((prompt) => (
              <button
                key={prompt.prompt_key}
                type="button"
                className={`admin-prompt-card${prompt.prompt_key === activePromptKey ? " is-active" : ""}`}
                onClick={() => handleSelect(prompt.prompt_key)}
              >
                <div className="admin-prompt-card-top">
                  <strong>{PROMPT_LABELS[prompt.prompt_key] ?? prompt.prompt_key}</strong>
                  <span className="muted">v{prompt.version}</span>
                </div>
                <p>{prompt.description}</p>
                <div className="assistant-session-metrics">
                  <span className={`tag${prompt.enabled ? "" : " is-muted"}`}>{prompt.enabled ? "Enabled" : "Disabled"}</span>
                  <span className="tag">{prompt.prompt_key}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel admin-prompts-editor">
          <div className="section-header">
            <div>
              <p className="eyebrow">Editor</p>
              <h2>{activeLabel}</h2>
              {activePrompt ? <p className="muted">Version {activePrompt.version} last updated {new Date(activePrompt.updated_at).toLocaleString("zh-TW")}</p> : null}
            </div>
          </div>

          {activePrompt ? (
            <form className="stack" onSubmit={handleSubmit}>
              <label className="stack">
                <span className="assistant-turn-label">Title</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  maxLength={MAX_PROMPT_TITLE_LENGTH}
                />
                <span className="muted">
                  {draft.title.length} / {MAX_PROMPT_TITLE_LENGTH} characters
                </span>
              </label>

              <label className="stack">
                <span className="assistant-turn-label">Description</span>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  maxLength={MAX_PROMPT_DESCRIPTION_LENGTH}
                />
                <span className="muted">
                  {draft.description.length} / {MAX_PROMPT_DESCRIPTION_LENGTH} characters
                </span>
              </label>

              <label className="stack">
                <span className="assistant-turn-label">Prompt Content</span>
                <textarea
                  rows={16}
                  value={draft.content}
                  onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                  maxLength={MAX_PROMPT_CONTENT_LENGTH}
                />
                <span className="muted">
                  {draft.content.length} / {MAX_PROMPT_CONTENT_LENGTH} characters
                </span>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
                />
                <span>Enabled</span>
              </label>

              <div className="action-row">
                <span className="muted">Saving creates a new version number on the server.</span>
                <div className="action-row">
                  <button type="button" className="text-button" onClick={() => handleReset().catch(console.error)} disabled={saving}>
                    Reset
                  </button>
                  <button className="primary-button" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="nested-panel">
              <p>No prompts found.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
