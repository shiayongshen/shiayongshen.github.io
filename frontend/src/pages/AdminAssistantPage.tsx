import { FormEvent, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useNavigate } from "react-router-dom";
import { Seo } from "../components/Seo";
import { api } from "../lib/api";
import type {
  AssistantConversationSessionDetail,
  AssistantConversationSessionSummary,
  AssistantConversationTurnRecord,
} from "../lib/types";

type AdminAssistantPageProps = {
  token: string;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConversationTurnCard({ turn }: { turn: AssistantConversationTurnRecord }) {
  return (
    <article className="nested-panel assistant-turn-card">
      <div className="assistant-turn-meta">
        <span className="label">Turn {turn.turn_index}</span>
        <span className="muted">{formatDateTime(turn.created_at)}</span>
      </div>

      <div className="assistant-turn-block">
        <p className="assistant-turn-label">User Question</p>
        <p>{turn.question}</p>
      </div>

      <div className="assistant-turn-block">
        <p className="assistant-turn-label">Assistant Answer</p>
        <div className="markdown-body assistant-turn-answer">
          <ReactMarkdown>{turn.answer}</ReactMarkdown>
        </div>
      </div>

      <div className="assistant-turn-badges">
        <span className="tag">{turn.show_sources ? "Sources visible" : "Sources hidden"}</span>
        <span className="tag">{turn.model_name || "fallback"}</span>
        <span className="tag">{turn.latency_ms} ms</span>
        <span className="tag">{turn.selected_skills.length} skills</span>
        <span className="tag">{turn.total_tokens.toLocaleString()} tokens</span>
        <span className="tag">{turn.usage_source}</span>
      </div>

      <div className="assistant-session-metrics">
        {Object.entries(turn.prompt_versions).map(([key, version]) => (
          <span key={`${turn.id}-${key}`} className="tag">
            {key}: v{version}
          </span>
        ))}
      </div>

      {turn.history.length ? (
        <div className="stack">
          <p className="assistant-turn-label">Context Sent to Model</p>
          <div className="assistant-history-list">
            {turn.history.map((item, index) => (
              <article key={`${turn.id}-${index}-${item.role}`} className="nested-panel assistant-history-item">
                <span className="label">{item.role}</span>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {turn.selected_skills.length ? (
        <div className="stack">
          <p className="assistant-turn-label">Selected Skills</p>
          <div className="assistant-card-grid">
            {turn.selected_skills.map((skill) => (
              <article key={skill.id} className="nested-panel assistant-mini-card">
                <strong>{skill.skill_name}</strong>
                <span className="muted">{skill.skill_type}</span>
                <p>{skill.summary}</p>
                {skill.url ? (
                  /^https?:\/\//.test(skill.url) ? (
                    <a href={skill.url} target="_blank" rel="noreferrer" className="primary-link">
                      Open
                    </a>
                  ) : (
                    <Link to={skill.url} className="primary-link">
                      Open
                    </Link>
                  )
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {turn.related_links.length ? (
        <div className="stack">
          <p className="assistant-turn-label">Related Links</p>
          <div className="link-row">
            {turn.related_links.map((link) =>
              /^https?:\/\//.test(link.url) ? (
                <a key={`${turn.id}-${link.type}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="primary-link">
                  {link.title}
                </a>
              ) : (
                <Link key={`${turn.id}-${link.type}-${link.url}`} to={link.url} className="primary-link">
                  {link.title}
                </Link>
              ),
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function AdminAssistantPage({ token }: AdminAssistantPageProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sessions, setSessions] = useState<AssistantConversationSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [detail, setDetail] = useState<AssistantConversationSessionDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  async function loadSessions(nextQuery = query, nextStartDate = startDate, nextEndDate = endDate) {
    setLoadingList(true);
    setError("");
    try {
      const data = await api.adminGetAssistantConversations(token, nextQuery, 50, nextStartDate, nextEndDate);
      setSessions(data);
      if (!data.length) {
        setActiveSessionId("");
        setDetail(null);
        return;
      }
      setActiveSessionId((current) => {
        if (current && data.some((item) => item.session_id === current)) {
          return current;
        }
        return data[0].session_id;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversations.");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetail(sessionId: string) {
    setLoadingDetail(true);
    setError("");
    try {
      const data = await api.adminGetAssistantConversation(token, sessionId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversation detail.");
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    loadSessions().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }
    loadDetail(activeSessionId).catch(console.error);
  }, [activeSessionId, token]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadSessions(query);
  }

  async function handleClearFilters() {
    setQuery("");
    setStartDate("");
    setEndDate("");
    await loadSessions("", "", "");
  }

  async function handleDeleteSession() {
    if (!activeSessionId) return;
    await api.adminDeleteAssistantConversation(token, activeSessionId);
    await loadSessions();
  }

  const totalTurns = sessions.reduce((sum, item) => sum + item.turn_count, 0);
  const totalTokens = sessions.reduce((sum, item) => sum + item.total_tokens, 0);

  return (
    <section className="stack admin-assistant-page">
      <Seo
        title="Chat Logs | Vincent Hsia"
        description="Admin dashboard for reviewing chatbot conversations, turns, and source selection."
        path="/admin/assistant"
        robots="noindex,nofollow"
      />

      <div className="section-header">
        <div>
          <p className="eyebrow">Assistant Dashboard</p>
          <h1>Chat Logs</h1>
          <p className="muted">Review conversation sessions, inspect turn-by-turn context, and remove stale logs.</p>
        </div>
        <div className="action-row">
          <button className="text-button" onClick={() => navigate("/admin")}>
            Back to Dashboard
          </button>
          <button className="primary-button" onClick={() => loadSessions().catch(console.error)} disabled={loadingList}>
            {loadingList ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="admin-kpi-grid">
        <article className="panel admin-kpi-card">
          <span className="label">Sessions</span>
          <strong>{sessions.length}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="label">Turns</span>
          <strong>{totalTurns}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="label">Total Tokens</span>
          <strong>{totalTokens.toLocaleString()}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="label">Active</span>
          <strong>{detail?.title || "None selected"}</strong>
        </article>
      </div>

      <form className="assistant-filter-form" onSubmit={handleSearch}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, question, or answer" />
        <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        <button className="primary-button">Search</button>
        <button type="button" className="text-button" onClick={() => handleClearFilters().catch(console.error)}>
          Clear
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="admin-assistant-layout">
        <aside className="panel admin-list-pane">
          <div className="section-header">
            <div>
              <p className="eyebrow">Sessions</p>
              <h2>Recent Conversations</h2>
            </div>
          </div>
          <div className="admin-session-list">
            {sessions.length ? (
              sessions.map((session) => (
                <button
                  key={session.session_id}
                  type="button"
                  className={`admin-session-row${session.session_id === activeSessionId ? " is-active" : ""}`}
                  onClick={() => setActiveSessionId(session.session_id)}
                >
                  <div className="admin-session-row-top">
                    <strong>{session.title || session.first_question}</strong>
                    <span className="muted">{session.turn_count} turns</span>
                  </div>
                  <p>{session.last_question || session.first_question}</p>
                  <div className="assistant-session-metrics">
                    <span className="tag">{session.last_model_name || "fallback"}</span>
                    <span className="tag">{session.last_latency_ms} ms</span>
                    <span className="tag">{session.last_total_tokens.toLocaleString()} tokens</span>
                  </div>
                  <span className="muted">{formatDateTime(session.updated_at)}</span>
                </button>
              ))
            ) : (
              <div className="nested-panel">
                <p>No conversation logs yet.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="panel admin-detail-pane">
          <div className="section-header">
            <div>
              <p className="eyebrow">Detail</p>
              <h2>{detail?.title || "Select a session"}</h2>
              <p className="muted">
                {detail ? `${detail.turn_count} turns, created ${formatDateTime(detail.created_at)}` : "Choose a session to inspect."}
              </p>
            </div>
            <button
              className="danger-button"
              onClick={() => handleDeleteSession().catch((err) => setError(err instanceof Error ? err.message : "Delete failed."))}
              disabled={!activeSessionId || loadingDetail}
              type="button"
            >
              Delete Session
            </button>
          </div>

          {loadingDetail ? <p className="muted">Loading conversation detail...</p> : null}

          {detail ? (
            <div className="assistant-detail-metrics">
              <article className="nested-panel assistant-detail-metric">
                <span className="label">Last Model</span>
                <strong>{detail.last_model_name || "fallback"}</strong>
              </article>
              <article className="nested-panel assistant-detail-metric">
                <span className="label">Last Latency</span>
                <strong>{detail.last_latency_ms} ms</strong>
              </article>
              <article className="nested-panel assistant-detail-metric">
                <span className="label">Session Tokens</span>
                <strong>{detail.total_tokens.toLocaleString()}</strong>
              </article>
              <article className="nested-panel assistant-detail-metric">
                <span className="label">Usage Source</span>
                <strong>{detail.turns.at(-1)?.usage_source ?? "estimated"}</strong>
              </article>
            </div>
          ) : null}

          {detail?.last_prompt_versions ? (
            <div className="assistant-session-metrics">
              {Object.entries(detail.last_prompt_versions).map(([key, version]) => (
                <span key={`detail-${key}`} className="tag">
                  {key}: v{version}
                </span>
              ))}
            </div>
          ) : null}

          <div className="stack">
            {detail?.turns.length ? (
              detail.turns.map((turn) => <ConversationTurnCard key={turn.id} turn={turn} />)
            ) : (
              <div className="nested-panel">
                <p>No turn data to display.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
