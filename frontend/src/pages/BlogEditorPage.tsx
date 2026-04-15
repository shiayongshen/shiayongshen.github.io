import type { BlogPost, BlogPostInput } from "../lib/types";
import { PostEditor } from "../components/PostEditor";
import { Seo } from "../components/Seo";

type BlogEditorPageProps = {
  post?: BlogPost;
  onSave: (payload: BlogPostInput, originalSlug?: string) => Promise<void>;
  onDelete: (slug: string) => Promise<void>;
  onCancel: () => void;
  onUploadImage: (file: File) => Promise<string>;
  onDeleteImage: (url: string) => Promise<void>;
};

export function BlogEditorPage({
  post,
  onSave,
  onDelete,
  onCancel,
  onUploadImage,
  onDeleteImage,
}: BlogEditorPageProps) {
  return (
    <div className="stack blog-editor-page">
      <Seo
        title={post ? `Edit ${post.title} | Vincent Hsia` : "Create Post | Vincent Hsia"}
        description="Internal editor for creating and updating blog posts."
        path={post ? `/admin/blog/${post.slug}/edit` : "/admin/blog/new"}
        robots="noindex,nofollow"
      />
      <section className="section-header">
        <div>
          <p className="eyebrow">Editor</p>
          <h1>{post ? `Edit ${post.title}` : "Create a new post"}</h1>
        </div>
      </section>
      <PostEditor
        post={post}
        onSave={onSave}
        onDelete={onDelete}
        onCancel={onCancel}
        onUploadImage={onUploadImage}
        onDeleteImage={onDeleteImage}
      />
    </div>
  );
}
