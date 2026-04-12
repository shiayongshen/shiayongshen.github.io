import type { BlogPost } from "../lib/types";
import { PostEditor } from "../components/PostEditor";

type BlogEditorPageProps = {
  post?: BlogPost;
  onSave: (payload: Omit<BlogPost, "created_at" | "updated_at">, originalSlug?: string) => Promise<void>;
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
