import ReactMarkdown from "react-markdown";
import type { BlogPost } from "../lib/types";

type PostPageProps = {
  post: BlogPost | null;
  isAdmin: boolean;
  onEdit: (post: BlogPost) => void;
};

export function PostPage({ post, isAdmin, onEdit }: PostPageProps) {
  if (!post) {
    return <div className="panel">Loading article...</div>;
  }

  return (
    <article className="panel article">
      {post.cover_image_url ? <img className="article-cover" src={post.cover_image_url} alt={post.title} /> : null}
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
          <button className="primary-button" onClick={() => onEdit(post)}>
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
