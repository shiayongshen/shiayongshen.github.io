import { FormEvent, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { PostEditor } from "../components/PostEditor";
import { Seo } from "../components/Seo";
import { api } from "../lib/api";
import type { BlogComment, BlogPost, BlogPostInput } from "../lib/types";

type PostPageProps = {
  post: BlogPost | null;
  isAdmin: boolean;
  onEdit: (post: BlogPost) => void;
  onSavePost: (payload: BlogPostInput, originalSlug?: string) => Promise<void>;
  onDeletePost: (slug: string) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onDeleteImage: (url: string) => Promise<void>;
};

export function PostPage({ post, isAdmin, onEdit, onSavePost, onDeletePost, onUploadImage, onDeleteImage }: PostPageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [commentName, setCommentName] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [isLiking, setIsLiking] = useState(false);
  const [metrics, setMetrics] = useState(() =>
    post ? { view_count: post.view_count, like_count: post.like_count } : { view_count: 0, like_count: 0 },
  );
  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    if (!post) return;
    setMetrics({ view_count: post.view_count, like_count: post.like_count });
    setHasLiked(window.localStorage.getItem(`liked-post:${post.slug}`) === "true");
  }, [post]);

  useEffect(() => {
    if (!post) return;
    const loadComments = async () => {
      if (isAdmin) {
        const token = localStorage.getItem("admin_token") ?? "";
        setComments(await api.adminGetBlogComments(token, post.slug));
        return;
      }
      setComments(await api.getBlogComments(post.slug));
    };
    loadComments().catch((error) => {
      console.error(error);
      setComments([]);
    });
  }, [isAdmin, post]);

  useEffect(() => {
    if (!post) return;
    const viewedKey = `viewed-post:${post.slug}`;
    if (window.sessionStorage.getItem(viewedKey) === "true") return;

    api.trackBlogPostView(post.slug)
      .then((nextMetrics) => {
        setMetrics(nextMetrics);
        window.sessionStorage.setItem(viewedKey, "true");
      })
      .catch(console.error);
  }, [post]);

  const articleStats = useMemo(
    () => ({ viewCount: metrics.view_count, likeCount: metrics.like_count, commentCount: comments.length }),
    [comments.length, metrics.like_count, metrics.view_count],
  );

  if (!post) {
    return <div className="panel">Loading article...</div>;
  }

  const currentPost = post;

  if (isEditing) {
    return (
      <PostEditor
        post={currentPost}
        inline
        title={`Editing ${currentPost.title}`}
        backLabel="Close"
        onSave={async (payload, originalSlug) => {
          await onSavePost(payload, originalSlug);
          setIsEditing(false);
        }}
        onDelete={async (slug) => {
          await onDeletePost(slug);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
        onUploadImage={onUploadImage}
        onDeleteImage={onDeleteImage}
      />
    );
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingComment(true);
    setCommentError("");
    try {
      const created = await api.createBlogComment(currentPost.slug, commentName, commentMessage);
      if (isAdmin) {
        setComments((current) => [created, ...current]);
      }
      setCommentName("");
      setCommentMessage("");
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Could not submit comment");
    } finally {
      setIsSubmittingComment(false);
    }
  }

  async function handleLike() {
    if (hasLiked) return;
    setIsLiking(true);
    try {
      const nextMetrics = await api.likeBlogPost(currentPost.slug);
      setMetrics(nextMetrics);
      window.localStorage.setItem(`liked-post:${currentPost.slug}`, "true");
      setHasLiked(true);
    } finally {
      setIsLiking(false);
    }
  }

  async function handleAdminCommentSave(commentId: number, payload: Pick<BlogComment, "name" | "message" | "approved">) {
    const token = localStorage.getItem("admin_token") ?? "";
    const nextComment = await api.adminUpdateBlogComment(token, currentPost.slug, commentId, payload);
    setComments((current) => current.map((comment) => (comment.id === commentId ? nextComment : comment)));
  }

  async function handleAdminCommentDelete(commentId: number) {
    const token = localStorage.getItem("admin_token") ?? "";
    await api.adminDeleteBlogComment(token, currentPost.slug, commentId);
    setComments((current) => current.filter((comment) => comment.id !== commentId));
  }

  return (
    <div className="stack">
      <article className="panel article">
        <Seo
          title={`${post.title} | Vincent Hsia`}
          description={post.summary}
          path={`/blog/${currentPost.slug}`}
          image={post.cover_image_url || undefined}
          type="article"
          publishedTime={currentPost.created_at}
          modifiedTime={currentPost.updated_at}
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: currentPost.title,
            description: currentPost.summary,
            image: currentPost.cover_image_url || undefined,
            datePublished: currentPost.created_at,
            dateModified: currentPost.updated_at,
            mainEntityOfPage: `/blog/${currentPost.slug}`,
            keywords: currentPost.tags.join(", "),
            articleSection: currentPost.category,
            author: {
              "@type": "Person",
              name: "Vincent Hsia",
            },
          }}
        />
        {currentPost.cover_image_url ? <img className="article-cover" src={currentPost.cover_image_url} alt={currentPost.title} loading="lazy" /> : null}
        <div className="post-meta">
          <span>{new Date(currentPost.created_at).toLocaleDateString()}</span>
          <span>{currentPost.category}</span>
          <span>{currentPost.published ? "Published" : "Draft"}</span>
        </div>
        <h1>{currentPost.title}</h1>
        <p className="article-summary">{currentPost.summary}</p>
        <div className="article-engagement-bar">
          <div className="article-stats">
            <span>{articleStats.viewCount} views</span>
            <span>{articleStats.likeCount} likes</span>
            <span>{articleStats.commentCount} comments</span>
          </div>
          <button type="button" className="primary-button" onClick={handleLike} disabled={isLiking || hasLiked}>
            {hasLiked ? "Liked" : isLiking ? "Liking..." : "Like"}
          </button>
        </div>
        <div className="tag-row">
          {currentPost.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        {isAdmin ? (
          <div className="action-row">
            <button
              className="primary-button"
              onClick={() => {
                onEdit(currentPost);
                setIsEditing(true);
              }}
            >
              Edit This Post
            </button>
          </div>
        ) : null}
        <div className="markdown-body">
          <ReactMarkdown>{currentPost.content_markdown}</ReactMarkdown>
        </div>
      </article>

      <section className="panel stack">
        <div className="section-header">
          <div>
            <p className="eyebrow">Comments</p>
            <h2>Join the discussion</h2>
          </div>
        </div>
        <form className="stack" onSubmit={handleCommentSubmit}>
          <input value={commentName} onChange={(event) => setCommentName(event.target.value)} placeholder="Your name" required />
          <textarea
            value={commentMessage}
            onChange={(event) => setCommentMessage(event.target.value)}
            placeholder="Share your thoughts"
            rows={5}
            required
          />
          <div className="action-row">
            <button className="primary-button" disabled={isSubmittingComment}>
              {isSubmittingComment ? "Sending..." : "Post Comment"}
            </button>
            {!isAdmin ? <span className="muted">Comments appear after approval.</span> : null}
          </div>
          {commentError ? <p className="error-text">{commentError}</p> : null}
        </form>

        <div className="stack">
          {comments.length ? (
            comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                isAdmin={isAdmin}
                onSave={handleAdminCommentSave}
                onDelete={handleAdminCommentDelete}
              />
            ))
          ) : (
            <div className="nested-panel">
              <p className="muted">No comments yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CommentCard({
  comment,
  isAdmin,
  onSave,
  onDelete,
}: {
  comment: BlogComment;
  isAdmin: boolean;
  onSave: (commentId: number, payload: Pick<BlogComment, "name" | "message" | "approved">) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Pick<BlogComment, "name" | "message" | "approved">>({
    name: comment.name,
    message: comment.message,
    approved: comment.approved,
  });

  useEffect(() => {
    setDraft({ name: comment.name, message: comment.message, approved: comment.approved });
  }, [comment]);

  if (isAdmin && isEditing) {
    return (
      <article className="panel stack guestbook-entry-editing">
        <div className="post-meta">
          <strong>Editing comment</strong>
          <span>{new Date(comment.created_at).toLocaleDateString()}</span>
        </div>
        <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        <textarea
          value={draft.message}
          onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))}
          rows={5}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.approved}
            onChange={(event) => setDraft((current) => ({ ...current, approved: event.target.checked }))}
          />
          Approved
        </label>
        <div className="action-row">
          <button
            className="primary-button"
            onClick={async () => {
              await onSave(comment.id, draft);
              setIsEditing(false);
            }}
          >
            Save
          </button>
          <button type="button" className="danger-button" onClick={() => onDelete(comment.id)}>
            Delete
          </button>
          <button type="button" className="text-button" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="panel">
      <div className="post-meta">
        <strong>{comment.name}</strong>
        <span>{new Date(comment.created_at).toLocaleDateString()}</span>
        {isAdmin ? <span>{comment.approved ? "Approved" : "Pending"}</span> : null}
      </div>
      <p>{comment.message}</p>
      {isAdmin ? (
        <div className="action-row">
          <button type="button" className="text-button" onClick={() => setIsEditing(true)}>
            Edit
          </button>
        </div>
      ) : null}
    </article>
  );
}
