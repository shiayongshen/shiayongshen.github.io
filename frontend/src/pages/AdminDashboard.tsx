import { Seo } from "../components/Seo";

type AdminDashboardProps = {
  onEditProfile: () => void;
  onCreatePost: () => void;
  onOpenAssistantLogs: () => void;
  onOpenPrompts: () => void;
  onOpenPromptRunner: () => void;
};

export function AdminDashboard({
  onEditProfile,
  onCreatePost,
  onOpenAssistantLogs,
  onOpenPrompts,
  onOpenPromptRunner,
}: AdminDashboardProps) {
  return (
    <section className="grid-two">
      <Seo
        title="Admin Dashboard | Vincent Hsia"
        description="Internal dashboard for managing profile and blog content."
        path="/admin"
        robots="noindex,nofollow"
      />
      <article className="panel">
        <p className="eyebrow">Profile</p>
        <h2>Edit resume and about page</h2>
        <button className="primary-button" onClick={onEditProfile}>
          Open Profile Editor
        </button>
      </article>
      <article className="panel">
        <p className="eyebrow">Blog</p>
        <h2>Create or update markdown posts</h2>
        <button className="primary-button" onClick={onCreatePost}>
          Write New Post
        </button>
      </article>
      <article className="panel">
        <p className="eyebrow">Assistant</p>
        <h2>Review chatbot sessions and turn logs</h2>
        <button className="primary-button" onClick={onOpenAssistantLogs}>
          Open Chat Logs
        </button>
      </article>
      <article className="panel">
        <p className="eyebrow">Prompts</p>
        <h2>Edit system prompts and routing instructions</h2>
        <button className="primary-button" onClick={onOpenPrompts}>
          Open Prompt Manager
        </button>
      </article>
      <article className="panel">
        <p className="eyebrow">Runner</p>
        <h2>Test prompt drafts against live questions</h2>
        <button className="primary-button" onClick={onOpenPromptRunner}>
          Open Prompt Runner
        </button>
      </article>
    </section>
  );
}
