import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { AskAssistantResponse, AssistantConversationTurn } from "../lib/types";

const QUICK_QUESTIONS = [
  "What does Vincent build?",
  "Which projects are most related to AI?",
  "What should I read first to understand Vincent's work?",
  "What experience shows Vincent can ship end-to-end systems?",
];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  displayText?: string;
  response?: AskAssistantResponse;
};

const MAX_HISTORY_TURNS = 8;
const MAX_SESSION_QUESTIONS = 5;
const SESSION_STORAGE_KEY = "ask-vincent-session-question-count";

export function AskVincentPanel() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open, loading]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedCount = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    const parsedCount = storedCount ? Number.parseInt(storedCount, 10) : 0;
    setQuestionCount(Number.isFinite(parsedCount) ? Math.min(Math.max(parsedCount, 0), MAX_SESSION_QUESTIONS) : 0);
  }, []);

  const remainingQuestions = Math.max(0, MAX_SESSION_QUESTIONS - questionCount);
  const limitReached = remainingQuestions === 0;

  function incrementQuestionCount() {
    setQuestionCount((current) => {
      const nextCount = Math.min(current + 1, MAX_SESSION_QUESTIONS);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, String(nextCount));
      }
      return nextCount;
    });
  }

  function buildHistory(): AssistantConversationTurn[] {
    return messages
      .filter((message) => {
        if (message.role === "user") {
          return Boolean(message.text.trim());
        }
        return Boolean((message.response?.answer ?? message.text).trim());
      })
      .slice(-MAX_HISTORY_TURNS)
      .map((message) => ({
        role: message.role,
        text: message.role === "assistant" ? message.response?.answer ?? message.text : message.text,
      }));
  }

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    if (limitReached) {
      setError("This chat session has reached the 5-question limit.");
      setOpen(true);
      return;
    }
    const history = buildHistory();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setLoading(true);
    setError("");
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setOpen(true);
    const assistantId = `assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id: assistantId,
        role: "assistant",
        text: "",
        displayText: "",
      },
    ]);
    try {
      const response = await api.askAssistantStream(trimmed, history);
      if (!response.ok || !response.body) {
        throw new Error("Could not stream an answer right now.");
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
          const event = JSON.parse(trimmedLine) as
            | { type: "text_delta"; delta: string }
            | { type: "meta"; response: AskAssistantResponse }
            | { type: "done" };

          if (event.type === "text_delta") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      text: `${message.text}${event.delta}`,
                      displayText: `${message.displayText ?? ""}${event.delta}`,
                    }
                  : message,
              ),
            );
          }

          if (event.type === "meta") {
            incrementQuestionCount();
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      text: event.response.answer,
                      displayText: event.response.answer,
                      response: event.response,
                    }
                  : message,
              ),
            );
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get an answer right now.");
      setMessages((current) => current.filter((message) => message.id !== assistantId));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(question);
  }

  return (
    <div className={`ask-widget${open ? " is-open" : ""}`}>
      {open ? (
        <section className="panel stack ask-panel ask-popover">
          <div className="section-header">
            <div>
              <p className="eyebrow">Ask Vincent AI</p>
              <h2>Ask about background, projects, writing, or fit.</h2>
            </div>
            <button type="button" className="text-button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          {!messages.length ? (
            <div className="ask-chip-row">
              {QUICK_QUESTIONS.map((item) => (
                <button key={item} type="button" className="ask-chip" onClick={() => ask(item)} disabled={loading || limitReached}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}

          <div className="ask-thread">
            {messages.length ? (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={`ask-message${message.role === "user" ? " ask-message-user" : " ask-message-assistant"}${
                    message.role === "assistant" && !message.response ? " ask-message-typing" : ""
                  }`}
                >
                  <div className="ask-message-label">{message.role === "user" ? "You" : "Ask Vincent AI"}</div>
                  <div className="ask-message-bubble">
                    {message.role === "assistant" ? (
                      <div className="markdown-body ask-message-markdown">
                        <ReactMarkdown>{message.displayText ?? ""}</ReactMarkdown>
                        {!message.response ? <span className="ask-stream-caret" aria-hidden="true" /> : null}
                      </div>
                    ) : (
                      <p>{message.text}</p>
                    )}

                    {message.role === "assistant" &&
                    message.response?.show_sources &&
                    message.response.selected_skills.length ? (
                      <div className="stack ask-message-meta">
                        <div className="section-heading">
                          <span>Used Skills</span>
                        </div>
                        <div className="ask-skill-grid">
                          {message.response.selected_skills.map((skill) => (
                            <article key={skill.id} className="nested-panel ask-skill-card">
                              <div className="ask-skill-card-name">{skill.skill_name}</div>
                              <div className="ask-skill-card-type">{skill.skill_type}</div>
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
                              ) : (
                                null
                              )}
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {message.role === "assistant" &&
                    message.response?.show_sources &&
                    message.response.related_links.length ? (
                      <div className="stack ask-message-meta">
                        <div className="section-heading">
                          <span>Related Links</span>
                        </div>
                        <div className="link-row">
                          {message.response.related_links.map((link) =>
                            /^https?:\/\//.test(link.url) ? (
                              <a key={`${message.id}-${link.type}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="primary-link">
                                {link.title}
                              </a>
                            ) : (
                              <Link key={`${message.id}-${link.type}-${link.url}`} to={link.url} className="primary-link">
                                {link.title}
                              </Link>
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="nested-panel ask-empty">
                <p>Ask about Vincent's background, projects, writing, or role fit.</p>
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          <form className="stack ask-composer" onSubmit={handleSubmit}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              disabled={loading || limitReached}
              placeholder="Ask something like: Is Vincent a good fit for an AI product engineering role?"
            />
            <div className="action-row">
              <button className="primary-button" disabled={loading || limitReached}>
                {loading ? "Thinking..." : "Ask"}
              </button>
              <span className="muted">
                {limitReached
                  ? "This session has used all 5 questions."
                  : `${remainingQuestions} of ${MAX_SESSION_QUESTIONS} questions left in this session.`}
              </span>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="ask-fab"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Open Ask Vincent AI"
      >
        <span>AI</span>
      </button>
    </div>
  );
}
