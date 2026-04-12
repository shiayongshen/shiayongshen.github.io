import { FormEvent, useState } from "react";
import type { GuestbookEntry } from "../lib/types";

type GuestbookEditorProps = {
  entry: GuestbookEntry;
  onSave: (entryId: number, payload: Pick<GuestbookEntry, "name" | "message" | "approved">) => Promise<void>;
  onDelete: (entryId: number) => Promise<void>;
  onClose: () => void;
};

export function GuestbookEditor({ entry, onSave, onDelete, onClose }: GuestbookEditorProps) {
  const [form, setForm] = useState({
    name: entry.name,
    message: entry.message,
    approved: entry.approved,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(entry.id, form);
    onClose();
  }

  async function handleDelete() {
    await onDelete(entry.id);
    onClose();
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>Edit Guestbook Entry</h2>
          <button className="text-button" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <textarea rows={8} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.approved}
              onChange={(e) => setForm({ ...form, approved: e.target.checked })}
            />
            Approved
          </label>
          <div className="action-row">
            <button className="primary-button">Save Entry</button>
            <button type="button" className="danger-button" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
