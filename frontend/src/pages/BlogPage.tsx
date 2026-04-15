import { useState } from "react";
import { Link } from "react-router-dom";
import { PostEditor } from "../components/PostEditor";
import { Seo } from "../components/Seo";
import type { BlogPost, BlogPostInput } from "../lib/types";

type BlogPageProps = {
  posts: BlogPost[];
  isAdmin: boolean;
  onCreate: () => void;
  onEdit: (post: BlogPost) => void;
  onSavePost: (payload: BlogPostInput, originalSlug?: string) => Promise<void>;
  onDeletePost: (slug: string) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onDeleteImage: (url: string) => Promise<void>;
};

export function BlogPage({
  posts,
  isAdmin,
  onCreate,
  onEdit,
  onSavePost,
  onDeletePost,
  onUploadImage,
  onDeleteImage,
}: BlogPageProps) {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const publishedPosts = posts.filter((post) => post.published);
  const latestCoverImage = publishedPosts[0]?.cover_image_url;

  return (
    <div className="stack">
      <Seo
        title="Blog | Vincent Hsia"
        description="Technical notes, experiments, and writing on engineering, AI workflows, and building useful systems."
        path="/blog"
        image={latestCoverImage}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Vincent Hsia Blog",
          description: "Technical notes, experiments, and writing on engineering, AI workflows, and building useful systems.",
          url: "/blog",
        }}
      />
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
        {posts.map((post) =>
          editingSlug === post.slug ? (
            <PostEditor
              key={post.slug}
              post={post}
              inline
              title={`Editing ${post.title}`}
              backLabel="Close"
              onSave={async (payload, originalSlug) => {
                await onSavePost(payload, originalSlug);
                setEditingSlug(null);
              }}
              onDelete={async (slug) => {
                await onDeletePost(slug);
                setEditingSlug(null);
              }}
              onCancel={() => setEditingSlug(null)}
              onUploadImage={onUploadImage}
              onDeleteImage={onDeleteImage}
            />
          ) : (
            <article key={post.slug} className="panel">
              {post.cover_image_url ? <img className="post-cover" src={post.cover_image_url} alt={post.title} loading="lazy" /> : null}
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
                  <button
                    className="text-button"
                    onClick={() => {
                      onEdit(post);
                      setEditingSlug(post.slug);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            </article>
          ),
        )}
      </div>
    </div>
  );
}
