import { Seo } from "../components/Seo";

type AdminDashboardProps = {
  onEditProfile: () => void;
  onCreatePost: () => void;
};

export function AdminDashboard({ onEditProfile, onCreatePost }: AdminDashboardProps) {
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
    </section>
  );
}
