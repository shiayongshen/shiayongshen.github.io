import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { BlogPost } from "../lib/types";

type DraftPost = Omit<BlogPost, "created_at" | "updated_at">;

type PostEditorProps = {
  post?: BlogPost;
  onSave: (payload: DraftPost, originalSlug?: string) => Promise<void>;
  onDelete?: (slug: string) => Promise<void>;
  onCancel: () => void;
  onUploadImage: (file: File) => Promise<string>;
  onDeleteImage: (url: string) => Promise<void>;
  inline?: boolean;
  title?: string;
  backLabel?: string;
};

export function PostEditor({
  post,
  onSave,
  onDelete,
  onCancel,
  onUploadImage,
  onDeleteImage,
  inline = false,
  title,
  backLabel = "Back",
}: PostEditorProps) {
  const baseDraft: DraftPost =
    post ?? {
      title: "",
      slug: "",
      summary: "",
      category: "engineering",
      cover_image_url: "",
      content_markdown: "# New Post\n\nWrite here.",
      tags: [],
      published: false,
    };
  const draftStorageKey = `blog-editor-draft:${post?.slug ?? "new"}`;
  const [form, setForm] = useState<DraftPost>(baseDraft);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"idle" | "restored" | "saved">("idle");
  const markdownRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const savedDraft = localStorage.getItem(draftStorageKey);
    if (!savedDraft) {
      setForm(baseDraft);
      setDraftStatus("idle");
      return;
    }

    try {
      const parsedDraft = JSON.parse(savedDraft) as DraftPost;
      setForm(parsedDraft);
      setDraftStatus("restored");
    } catch {
      localStorage.removeItem(draftStorageKey);
      setForm(baseDraft);
      setDraftStatus("idle");
    }
  }, [draftStorageKey, post?.slug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem(draftStorageKey, JSON.stringify(form));
      setDraftStatus("saved");
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [draftStorageKey, form]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(form, post?.slug);
    localStorage.removeItem(draftStorageKey);
    setDraftStatus("idle");
  }

  async function handleDelete() {
    if (!post || !onDelete) return;
    await onDelete(post.slug);
  }

  async function handleCoverUpload(file: File | undefined) {
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await onUploadImage(file);
      setForm((current) => ({ ...current, cover_image_url: url }));
    } finally {
      setUploadingCover(false);
    }
  }

  async function clearCoverImage() {
    if (form.cover_image_url) {
      await onDeleteImage(form.cover_image_url);
    }
    setForm((current) => ({ ...current, cover_image_url: "" }));
  }

  async function handleInlineImageUpload(file: File | undefined) {
    if (!file) return;
    setUploadingInlineImage(true);
    try {
      const url = await onUploadImage(file);
      const textarea = markdownRef.current;
      const imageMarkdown = `\n![${file.name}](${url})\n`;
      if (!textarea) {
        setForm((current) => ({ ...current, content_markdown: `${current.content_markdown}${imageMarkdown}` }));
        return;
      }

      const start = textarea.selectionStart ?? form.content_markdown.length;
      const end = textarea.selectionEnd ?? form.content_markdown.length;
      const nextContent =
        form.content_markdown.slice(0, start) + imageMarkdown + form.content_markdown.slice(end);

      setForm((current) => ({ ...current, content_markdown: nextContent }));
      requestAnimationFrame(() => {
        textarea.focus();
        const cursor = start + imageMarkdown.length;
        textarea.setSelectionRange(cursor, cursor);
      });
    } finally {
      setUploadingInlineImage(false);
    }
  }

  return (
    <section className={`panel stack${inline ? " inline-post-editor" : ""}`}>
      <div className="modal-header">
        <h2>{title ?? (post ? "Edit Post" : "New Post")}</h2>
        <button className="text-button" onClick={onCancel}>
          {backLabel}
        </button>
      </div>
      <div className="editor-split">
        <form className="stack" onSubmit={handleSubmit}>
          <div className="action-row">
            <span className="muted">
              {draftStatus === "restored"
                ? "Draft restored from local autosave"
                : draftStatus === "saved"
                  ? "Draft autosaved locally"
                  : "Autosave enabled"}
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                localStorage.removeItem(draftStorageKey);
                setForm(baseDraft);
                setDraftStatus("idle");
              }}
            >
              Clear Draft
            </button>
          </div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" />
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="slug-like-this" />
          <textarea
            rows={3}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="Summary"
          />
          <div className="inline-form">
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Category"
            />
            <input
              value={form.cover_image_url}
              onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
              placeholder="Cover image URL"
            />
          </div>
          <label className="upload-field">
            <span>Upload cover image</span>
            <input type="file" accept="image/*" onChange={(e) => handleCoverUpload(e.target.files?.[0])} />
            {uploadingCover ? <small>Uploading...</small> : null}
          </label>
          {form.cover_image_url ? (
            <div className="image-manager">
              <img className="image-preview image-preview-banner" src={form.cover_image_url} alt="Cover preview" />
              <button type="button" className="text-button" onClick={clearCoverImage}>
                Remove cover image
              </button>
            </div>
          ) : null}
          <label className="upload-field">
            <span>Insert image into markdown</span>
            <input type="file" accept="image/*" onChange={(e) => handleInlineImageUpload(e.target.files?.[0])} />
            {uploadingInlineImage ? <small>Uploading...</small> : <small>Uploads and inserts `![]()` at cursor</small>}
          </label>
          <textarea
            ref={markdownRef}
            rows={24}
            value={form.content_markdown}
            onChange={(e) => setForm({ ...form, content_markdown: e.target.value })}
          />
          <input
            value={form.tags.join(", ")}
            onChange={(e) =>
              setForm({
                ...form,
                tags: e.target.value.split(",").map((item) => item.trim()).filter(Boolean),
              })
            }
            placeholder="tag1, tag2"
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
            />
            Published
          </label>
          <div className="action-row">
            <button className="primary-button">Save Post</button>
            {post && onDelete ? (
              <button type="button" className="danger-button" onClick={handleDelete}>
                Delete
              </button>
            ) : null}
            <button type="button" className="text-button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>

        <aside className="panel preview-pane">
          <div className="section-heading">
            <span>Live Preview</span>
          </div>
          {form.cover_image_url ? <img className="image-preview image-preview-banner" src={form.cover_image_url} alt={form.title} /> : null}
          <div className="stack">
            <div className="post-meta">
              <span>{form.category || "category"}</span>
              <span>{form.published ? "Published" : "Draft"}</span>
            </div>
            <h2>{form.title || "Untitled post"}</h2>
            <p className="muted">{form.summary || "Summary preview"}</p>
            <div className="tag-row">
              {form.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
            <div className="markdown-body">
              <ReactMarkdown>{form.content_markdown}</ReactMarkdown>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
