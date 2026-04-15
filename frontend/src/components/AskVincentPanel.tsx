import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { AskAssistantResponse } from "../lib/types";

const QUICK_QUESTIONS = [
  "What does Vincent build?",
  "Which projects are most related to AI?",
  "What should I read first to understand Vincent's work?",
  "What experience shows Vincent can ship end-to-end systems?",
];

export function AskVincentPanel() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AskAssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setQuestion(trimmed);
    try {
      setResponse(await api.askAssistant(trimmed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get an answer right now.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(question);
  }

  return (
    <section className="panel stack ask-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Ask Vincent AI</p>
          <h2>Ask about background, projects, writing, or fit.</h2>
        </div>
      </div>

      <div className="ask-chip-row">
        {QUICK_QUESTIONS.map((item) => (
          <button key={item} type="button" className="ask-chip" onClick={() => ask(item)} disabled={loading}>
            {item}
          </button>
        ))}
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          placeholder="Ask something like: Is Vincent a good fit for an AI product engineering role?"
        />
        <div className="action-row">
          <button className="primary-button" disabled={loading}>
            {loading ? "Thinking..." : "Ask"}
          </button>
          <span className="muted">Answers are grounded in the site content.</span>
        </div>
      </form>

      {error ? <p className="error-text">{error}</p> : null}

      {response ? (
        <div className="stack ask-response">
          <div className="nested-panel">
            <p>{response.answer}</p>
          </div>

          {response.selected_skills.length ? (
            <div className="stack">
              <div className="section-heading">
                <span>Used Skills</span>
              </div>
              <div className="ask-skill-grid">
                {response.selected_skills.map((skill) => (
                  <article key={skill.id} className="nested-panel ask-skill-card">
                    <div className="stack">
                      <div className="post-meta">
                        <strong>{skill.skill_name}</strong>
                        <span>{skill.skill_type}</span>
                      </div>
                      <p className="muted">{skill.summary}</p>
                      <div className="tag-row">
                        {skill.tags.slice(0, 4).filter(Boolean).map((tag) => (
                          <span key={`${skill.id}-${tag}`} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {response.related_links.length ? (
            <div className="stack">
              <div className="section-heading">
                <span>Related Links</span>
              </div>
              <div className="link-row">
                {response.related_links.map((link) => (
                  /^https?:\/\//.test(link.url) ? (
                    <a key={`${link.type}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="primary-link">
                      {link.title}
                    </a>
                  ) : (
                    <Link key={`${link.type}-${link.url}`} to={link.url} className="primary-link">
                      {link.title}
                    </Link>
                  )
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
