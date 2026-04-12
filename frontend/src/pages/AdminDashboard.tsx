type AdminDashboardProps = {
  onEditProfile: () => void;
  onCreatePost: () => void;
};

export function AdminDashboard({ onEditProfile, onCreatePost }: AdminDashboardProps) {
  return (
    <section className="grid-two">
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
