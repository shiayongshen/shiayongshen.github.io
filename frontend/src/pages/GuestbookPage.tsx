import { FormEvent, useState } from "react";
import { Seo } from "../components/Seo";
import type { GuestbookEntry } from "../lib/types";

type GuestbookPageProps = {
  entries: GuestbookEntry[];
  isAdmin: boolean;
  onSubmit: (name: string, message: string) => Promise<void>;
  onSaveEntry: (entryId: number, payload: Pick<GuestbookEntry, "name" | "message" | "approved">) => Promise<void>;
  onDeleteEntry: (entryId: number) => Promise<void>;
};

export function GuestbookPage({ entries, isAdmin, onSubmit, onSaveEntry, onDeleteEntry }: GuestbookPageProps) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Pick<GuestbookEntry, "name" | "message" | "approved">>>({});

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

  function startEditing(entry: GuestbookEntry) {
    setEditingEntryId(entry.id);
    setDrafts((current) => ({
      ...current,
      [entry.id]: {
        name: entry.name,
        message: entry.message,
        approved: entry.approved,
      },
    }));
  }

  function updateDraft(entryId: number, patch: Partial<Pick<GuestbookEntry, "name" | "message" | "approved">>) {
    setDrafts((current) => ({
      ...current,
      [entryId]: {
        ...current[entryId],
        ...patch,
      },
    }));
  }

  async function saveEntry(entryId: number) {
    const draft = drafts[entryId];
    if (!draft) return;
    await onSaveEntry(entryId, draft);
    setEditingEntryId(null);
  }

  async function deleteEntry(entryId: number) {
    await onDeleteEntry(entryId);
    setEditingEntryId(null);
  }

  return (
    <div className="grid-two guestbook-layout">
      <Seo
        title="Guestbook | Vincent Hsia"
        description="Leave a note and say hello. Approved messages from visitors are published in the guestbook."
        path="/guestbook"
      />
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
        {entries.map((entry) => {
          const isEditing = editingEntryId === entry.id;
          const draft = drafts[entry.id];

          return isEditing && draft ? (
            <article key={entry.id} className="panel stack guestbook-entry-editing">
              <div className="post-meta">
                <strong>Editing entry</strong>
                <span>{new Date(entry.created_at).toLocaleDateString()}</span>
              </div>
              <input value={draft.name} onChange={(event) => updateDraft(entry.id, { name: event.target.value })} />
              <textarea
                value={draft.message}
                onChange={(event) => updateDraft(entry.id, { message: event.target.value })}
                rows={6}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.approved}
                  onChange={(event) => updateDraft(entry.id, { approved: event.target.checked })}
                />
                Approved
              </label>
              <div className="action-row">
                <button className="primary-button" onClick={() => saveEntry(entry.id)}>
                  Save
                </button>
                <button type="button" className="danger-button" onClick={() => deleteEntry(entry.id)}>
                  Delete
                </button>
                <button type="button" className="text-button" onClick={() => setEditingEntryId(null)}>
                  Cancel
                </button>
              </div>
            </article>
          ) : (
            <article key={entry.id} className="panel">
              <div className="post-meta">
                <strong>{entry.name}</strong>
                <span>{new Date(entry.created_at).toLocaleDateString()}</span>
              </div>
              <p>{entry.message}</p>
              {isAdmin ? (
                <div className="action-row">
                  <button className="text-button" onClick={() => startEditing(entry)}>
                    Edit
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
