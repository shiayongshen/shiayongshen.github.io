import { FormEvent, useState } from "react";
import type { GuestbookEntry } from "../lib/types";

type GuestbookPageProps = {
  entries: GuestbookEntry[];
  isAdmin: boolean;
  onSubmit: (name: string, message: string) => Promise<void>;
  onEdit: (entry: GuestbookEntry) => void;
};

export function GuestbookPage({ entries, isAdmin, onSubmit, onEdit }: GuestbookPageProps) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(name, message);
      setName("");
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid-two guestbook-layout">
      <section className="panel">
        <div className="section-heading">
          <span>Leave a message</span>
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Say hello"
            rows={6}
            required
          />
          <button className="primary-button" disabled={submitting}>
            {submitting ? "Sending..." : "Submit"}
          </button>
          <p className="muted">新留言預設為待審核，管理後台可核准或刪除。</p>
        </form>
      </section>

      <section className="stack">
        {entries.map((entry) => (
          <article key={entry.id} className="panel">
            <div className="post-meta">
              <strong>{entry.name}</strong>
              <span>{new Date(entry.created_at).toLocaleDateString()}</span>
            </div>
            <p>{entry.message}</p>
            {isAdmin ? (
              <div className="action-row">
                <button className="text-button" onClick={() => onEdit(entry)}>
                  Edit
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
