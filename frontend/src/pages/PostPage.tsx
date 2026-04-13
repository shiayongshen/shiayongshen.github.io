import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { PostEditor } from "../components/PostEditor";
import type { BlogPost } from "../lib/types";

type PostPageProps = {
  post: BlogPost | null;
  isAdmin: boolean;
  onEdit: (post: BlogPost) => void;
  onSavePost: (payload: Omit<BlogPost, "created_at" | "updated_at">, originalSlug?: string) => Promise<void>;
  onDeletePost: (slug: string) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onDeleteImage: (url: string) => Promise<void>;
};

export function PostPage({ post, isAdmin, onEdit, onSavePost, onDeletePost, onUploadImage, onDeleteImage }: PostPageProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (!post) {
    return <div className="panel">Loading article...</div>;
  }

  if (isEditing) {
    return (
      <PostEditor
        post={post}
        inline
        title={`Editing ${post.title}`}
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

  return (
    <article className="panel article">
      {post.cover_image_url ? <img className="article-cover" src={post.cover_image_url} alt={post.title} loading="lazy" /> : null}
      <div className="post-meta">
        <span>{new Date(post.created_at).toLocaleDateString()}</span>
        <span>{post.category}</span>
        <span>{post.published ? "Published" : "Draft"}</span>
      </div>
      <h1>{post.title}</h1>
      <p className="article-summary">{post.summary}</p>
      <div className="tag-row">
        {post.tags.map((tag) => (
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
              onEdit(post);
              setIsEditing(true);
            }}
          >
            Edit This Post
          </button>
        </div>
      ) : null}
      <div className="markdown-body">
        <ReactMarkdown>{post.content_markdown}</ReactMarkdown>
      </div>
    </article>
  );
}
