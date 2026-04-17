import { FormEvent, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Seo } from "../components/Seo";
import { api } from "../lib/api";
import type {
  AssistantConversationTurn,
  PromptTemplate,
  PromptTestRunnerResponse,
  PromptTestTemplateInput,
} from "../lib/types";

type AdminPromptRunnerPageProps = {
  token: string;
};

type HistoryDraft = AssistantConversationTurn & {
  id: string;
};

type PromptRunnerStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "meta"; response: PromptTestRunnerResponse }
  | { type: "done" };

const PROMPT_LABELS: Record<string, string> = {
  answer_system_prompt: "Answer Prompt",
  skill_selection_prompt: "Skill Selection Prompt",
  source_visibility_prompt: "Source Visibility Prompt",
};

const PROMPT_ORDER = ["answer_system_prompt", "skill_selection_prompt", "source_visibility_prompt"];

function draftFromPrompt(prompt: PromptTemplate): PromptTestTemplateInput {
  return {
    prompt_key: prompt.prompt_key,
    title: prompt.title,
    description: prompt.description,
    content: prompt.content,
    enabled: prompt.enabled,
  };
}

function emptyHistoryRow(role: AssistantConversationTurn["role"], id: string): HistoryDraft {
  return { id, role, text: "" };
}

function parsePromptTests(prompts: Record<string, PromptTestTemplateInput>): PromptTestTemplateInput[] {
  return PROMPT_ORDER.map((key) => prompts[key]).filter((item): item is PromptTestTemplateInput => Boolean(item));
}

function buildHistoryPayload(rows: HistoryDraft[]): AssistantConversationTurn[] {
  return rows
    .map((row) => ({ role: row.role, text: row.text.trim() }))
    .filter((row) => row.text.length > 0);
}

function createHistoryId() {
  return crypto.randomUUID();
}

function ResultMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="nested-panel assistant-detail-metric">
      <span className="label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function AdminPromptRunnerPage({ token }: AdminPromptRunnerPageProps) {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, PromptTestTemplateInput>>({});
  const [activePromptKey, setActivePromptKey] = useState("");
  const [question, setQuestion] = useState("What can you help me with?");
  const [limit, setLimit] = useState(4);
  const [historyRows, setHistoryRows] = useState<HistoryDraft[]>([
    emptyHistoryRow("user", createHistoryId()),
    emptyHistoryRow("assistant", createHistoryId()),
  ]);
  const [result, setResult] = useState<PromptTestRunnerResponse | null>(null);
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const activePrompt = useMemo(
    () => prompts.find((item) => item.prompt_key === activePromptKey) ?? null,
    [prompts, activePromptKey],
  );

  const activeDraft = activePromptKey ? promptDrafts[activePromptKey] ?? null : null;

  async function loadPrompts(nextActiveKey?: string) {
    setLoading(true);
    setError("");
    try {
      const data = await api.adminGetPrompts(token);
      setPrompts(data);
      const drafts = Object.fromEntries(data.map((prompt) => [prompt.prompt_key, draftFromPrompt(prompt)]));
      setPromptDrafts(drafts);
      const selectedKey = nextActiveKey && data.some((item) => item.prompt_key === nextActiveKey) ? nextActiveKey : data[0]?.prompt_key ?? "";
      setActivePromptKey(selectedKey);
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

  function handleSelect(promptKey: string) {
    setActivePromptKey(promptKey);
  }

  function updateActiveDraft<K extends keyof PromptTestTemplateInput>(field: K, value: PromptTestTemplateInput[K]) {
    if (!activePromptKey) return;
    setPromptDrafts((current) => ({
      ...current,
      [activePromptKey]: {
        ...(current[activePromptKey] ?? {}),
        [field]: value,
      },
    }));
  }

  function resetActiveDraft() {
    if (!activePromptKey) return;
    const original = prompts.find((item) => item.prompt_key === activePromptKey);
    if (!original) return;
    setPromptDrafts((current) => ({
      ...current,
      [activePromptKey]: draftFromPrompt(original),
    }));
  }

  function addHistoryRow(role: AssistantConversationTurn["role"] = "user") {
    setHistoryRows((current) => [...current, emptyHistoryRow(role, createHistoryId())]);
  }

  function removeHistoryRow(id: string) {
    setHistoryRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  function updateHistoryRole(id: string, role: AssistantConversationTurn["role"]) {
    setHistoryRows((current) => current.map((row) => (row.id === id ? { ...row, role } : row)));
  }

  function updateHistoryText(id: string, text: string) {
    setHistoryRows((current) => current.map((row) => (row.id === id ? { ...row, text } : row)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) {
      setError("Please enter a question to test.");
      return;
    }
    setRunning(true);
    setResult(null);
    setStreamingAnswer("");
    setError("");
    try {
      const response = await api.adminTestPromptRunnerStream(token, {
        question: question.trim(),
        history: buildHistoryPayload(historyRows),
        prompts: parsePromptTests(promptDrafts),
        limit,
      });
      if (!response.ok || !response.body) {
        throw new Error("Could not stream a prompt test right now.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          const event = JSON.parse(trimmedLine) as PromptRunnerStreamEvent;
          if (event.type === "text_delta") {
            setStreamingAnswer((current) => `${current}${event.delta}`);
            continue;
          }
          if (event.type === "meta") {
            setResult(event.response);
            setStreamingAnswer(event.response.answer);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run prompt test.");
    } finally {
      setRunning(false);
    }
  }

  const enabledCount = prompts.filter((prompt) => prompt.enabled).length;

  return (
    <section className="stack admin-prompt-runner-page">
      <Seo
        title="Prompt Test Runner | Vincent Hsia"
        description="Admin runner for testing assistant prompts against live questions."
        path="/admin/prompts/test"
        robots="noindex,nofollow"
      />

      <div className="section-header">
        <div>
          <p className="eyebrow">Prompt Test Runner</p>
          <h1>Run a prompt draft</h1>
          <p className="muted">Edit the in-memory prompt draft, send a test question, and inspect the generated answer without saving changes.</p>
        </div>
        <div className="action-row">
          <button className="text-button" type="button" onClick={() => loadPrompts(activePromptKey).catch(console.error)} disabled={loading}>
            {loading ? "Refreshing..." : "Reload Saved Prompts"}
          </button>
          <button className="primary-button" type="button" onClick={() => setResult(null)} disabled={!result}>
            Clear Result
          </button>
        </div>
      </div>

      <div className="admin-kpi-grid">
        <article className="panel admin-kpi-card">
          <span className="label">Templates</span>
          <strong>{prompts.length}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="label">Enabled</span>
          <strong>{enabledCount}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="label">History Turns</span>
          <strong>{historyRows.filter((row) => row.text.trim()).length}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="label">Active Prompt</span>
          <strong>{activePrompt ? PROMPT_LABELS[activePrompt.prompt_key] ?? activePrompt.prompt_key : "None"}</strong>
        </article>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="admin-runner-layout">
        <aside className="panel admin-runner-list">
          <div className="section-header">
            <div>
              <p className="eyebrow">Templates</p>
              <h2>Prompt Drafts</h2>
            </div>
            <button className="primary-button" type="button" onClick={() => loadPrompts(activePromptKey).catch(console.error)} disabled={loading}>
              {loading ? "Loading..." : "Reload"}
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

        <section className="panel admin-runner-workbench">
          <form className="stack" onSubmit={handleSubmit}>
            <div className="section-header">
              <div>
                <p className="eyebrow">Draft Editor</p>
                <h2>{activePrompt ? PROMPT_LABELS[activePrompt.prompt_key] ?? activePrompt.prompt_key : "Select a prompt"}</h2>
                {activePrompt ? (
                  <p className="muted">
                    Saved version {activePrompt.version} last updated {new Date(activePrompt.updated_at).toLocaleString("zh-TW")}
                  </p>
                ) : null}
              </div>
              <div className="action-row">
                <button type="button" className="text-button" onClick={resetActiveDraft} disabled={!activePrompt}>
                  Reset Draft
                </button>
                <button className="primary-button" disabled={running}>
                  {running ? "Running..." : "Run Test"}
                </button>
              </div>
            </div>

            {activeDraft ? (
              <div className="stack">
                <label className="stack">
                  <span className="assistant-turn-label">Title</span>
                  <input value={activeDraft.title} onChange={(event) => updateActiveDraft("title", event.target.value)} />
                </label>

                <label className="stack">
                  <span className="assistant-turn-label">Description</span>
                  <textarea
                    rows={3}
                    value={activeDraft.description}
                    onChange={(event) => updateActiveDraft("description", event.target.value)}
                  />
                </label>

                <label className="stack">
                  <span className="assistant-turn-label">Prompt Content</span>
                  <textarea
                    rows={14}
                    value={activeDraft.content}
                    onChange={(event) => updateActiveDraft("content", event.target.value)}
                  />
                </label>

                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={activeDraft.enabled}
                    onChange={(event) => updateActiveDraft("enabled", event.target.checked)}
                  />
                  <span>Enabled in this test run</span>
                </label>
              </div>
            ) : (
              <div className="nested-panel">
                <p>No prompt draft selected.</p>
              </div>
            )}

            <div className="nested-panel stack">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Test Input</p>
                  <h2>Question and History</h2>
                </div>
              </div>

              <label className="stack">
                <span className="assistant-turn-label">Question</span>
                <textarea rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} />
              </label>

              <div className="assistant-detail-metrics">
                <label className="stack admin-runner-limit">
                  <span className="assistant-turn-label">Skill limit</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={limit}
                    onChange={(event) => setLimit(Number(event.target.value) || 4)}
                  />
                </label>
              </div>

              <div className="stack">
                <div className="section-header">
                  <div>
                    <p className="assistant-turn-label">History</p>
                    <p className="muted">Add prior turns if you want to test follow-up behavior.</p>
                  </div>
                  <div className="action-row">
                    <button type="button" className="text-button" onClick={() => addHistoryRow("user")}>
                      Add User Turn
                    </button>
                    <button type="button" className="text-button" onClick={() => addHistoryRow("assistant")}>
                      Add Assistant Turn
                    </button>
                  </div>
                </div>

                <div className="stack">
                  {historyRows.map((row) => (
                    <article key={row.id} className="nested-panel admin-runner-history-row">
                      <div className="section-header">
                        <label className="stack admin-runner-role-field">
                          <span className="assistant-turn-label">Role</span>
                          <select value={row.role} onChange={(event) => updateHistoryRole(row.id, event.target.value as AssistantConversationTurn["role"])}>
                            <option value="user">User</option>
                            <option value="assistant">Assistant</option>
                          </select>
                        </label>
                        <button type="button" className="text-button" onClick={() => removeHistoryRow(row.id)} disabled={historyRows.length <= 1}>
                          Remove
                        </button>
                      </div>
                      <label className="stack">
                        <span className="assistant-turn-label">Text</span>
                        <textarea rows={3} value={row.text} onChange={(event) => updateHistoryText(row.id, event.target.value)} />
                      </label>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </form>

          <section className="stack admin-runner-result">
            <div className="section-header">
              <div>
                <p className="eyebrow">Result</p>
                <h2>Latest Run</h2>
              </div>
            </div>

            {result ? (
              <>
                <div className="assistant-detail-metrics">
                <ResultMetric label="Model" value={result.model_name || "fallback"} />
                <ResultMetric label="Latency" value={`${result.latency_ms} ms`} />
                <ResultMetric label="Tokens" value={result.total_tokens.toLocaleString()} />
                <ResultMetric label="Usage" value={result.usage_source} />
              </div>

                <div className="assistant-session-metrics">
                  <span className={`tag${result.show_sources ? "" : " is-muted"}`}>{result.show_sources ? "Sources visible" : "Sources hidden"}</span>
                  {Object.entries(result.prompt_versions).map(([key, version]) => (
                    <span key={`runner-version-${key}`} className="tag">
                      {key}: v{version}
                    </span>
                  ))}
                </div>

                <article className="nested-panel stack">
                  <p className="assistant-turn-label">Answer</p>
                  <div className="markdown-body assistant-turn-answer">
                    <ReactMarkdown>{streamingAnswer || result.answer}</ReactMarkdown>
                  </div>
                  {running && !result ? <span className="ask-stream-caret" aria-hidden="true" /> : null}
                </article>

                {result.selected_skills.length ? (
                  <div className="stack">
                    <p className="assistant-turn-label">Selected Skills</p>
                    <div className="assistant-card-grid">
                      {result.selected_skills.map((skill) => (
                        <article key={skill.id} className="nested-panel assistant-mini-card">
                          <strong>{skill.skill_name}</strong>
                          <span className="muted">{skill.skill_type}</span>
                          <p>{skill.summary}</p>
                          {skill.url ? (
                            <a href={skill.url} target="_blank" rel="noreferrer" className="primary-link">
                              Open
                            </a>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                {result.related_links.length ? (
                  <div className="stack">
                    <p className="assistant-turn-label">Related Links</p>
                    <div className="link-row">
                      {result.related_links.map((link) => (
                        <a key={`${link.type}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="primary-link">
                          {link.title}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="nested-panel">
                <p>No test has been run yet.</p>
              </div>
            )}
          </section>
        </section>
      </div>
    </section>
  );
}
