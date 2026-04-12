import { Link } from "react-router-dom";
import type { BlogPost } from "../lib/types";

type BlogPageProps = {
  posts: BlogPost[];
  isAdmin: boolean;
  onCreate: () => void;
  onEdit: (post: BlogPost) => void;
};

export function BlogPage({ posts, isAdmin, onCreate, onEdit }: BlogPageProps) {
  return (
    <div className="stack">
      <section className="section-header">
        <div>
          <p className="eyebrow">Blog</p>
          <h1>Markdown writing archive</h1>
        </div>
        {isAdmin ? (
          <button className="primary-button" onClick={onCreate}>
            New Post
          </button>
        ) : null}
      </section>

      <div className="stack">
        {posts.map((post) => (
          <article key={post.slug} className="panel">
            {post.cover_image_url ? <img className="post-cover" src={post.cover_image_url} alt={post.title} /> : null}
            <div className="post-meta">
              <span>{new Date(post.created_at).toLocaleDateString()}</span>
              <span>{post.category}</span>
              <span>{post.published ? "Published" : "Draft"}</span>
            </div>
            <h2>{post.title}</h2>
            <p>{post.summary}</p>
            <div className="tag-row">
              {post.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
            <div className="action-row">
              <Link className="primary-link" to={`/blog/${post.slug}`}>
                Read article
              </Link>
              {isAdmin ? (
                <button className="text-button" onClick={() => onEdit(post)}>
                  Edit
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
