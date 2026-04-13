import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AboutPage } from "./pages/AboutPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { BlogEditorPage } from "./pages/BlogEditorPage";
import { BlogPage } from "./pages/BlogPage";
import { GuestbookPage } from "./pages/GuestbookPage";
import { LoginPage } from "./pages/LoginPage";
import { PostPage } from "./pages/PostPage";
import { api } from "./lib/api";
import type { BlogPost, GuestbookEntry, Profile } from "./lib/types";

function BlogPostRoute({
  posts,
  isAdmin,
  onEdit,
  onSavePost,
  onDeletePost,
  onUploadImage,
  onDeleteImage,
}: {
  posts: BlogPost[];
  isAdmin: boolean;
  onEdit: (post: BlogPost) => void;
  onSavePost: (payload: Omit<BlogPost, "created_at" | "updated_at">, originalSlug?: string) => Promise<void>;
  onDeletePost: (slug: string) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onDeleteImage: (url: string) => Promise<void>;
}) {
  const { slug } = useParams();
  const post = posts.find((item) => item.slug === slug) ?? null;
  return (
    <PostPage
      post={post}
      isAdmin={isAdmin}
      onEdit={onEdit}
      onSavePost={onSavePost}
      onDeletePost={onDeletePost}
      onUploadImage={onUploadImage}
      onDeleteImage={onDeleteImage}
    />
  );
}

function BlogEditorRoute({
  posts,
  onSave,
  onDelete,
  onCancel,
  onUploadImage,
  onDeleteImage,
}: {
  posts: BlogPost[];
  onSave: (payload: Omit<BlogPost, "created_at" | "updated_at">, originalSlug?: string) => Promise<void>;
  onDelete: (slug: string) => Promise<void>;
  onCancel: () => void;
  onUploadImage: (file: File) => Promise<string>;
  onDeleteImage: (url: string) => Promise<void>;
}) {
  const { slug } = useParams();
  const post = slug ? posts.find((item) => item.slug === slug) : undefined;
  if (slug && !post) {
    return <section className="panel">Post not found.</section>;
  }
  return (
    <BlogEditorPage
      post={post}
      onSave={onSave}
      onDelete={onDelete}
      onCancel={onCancel}
      onUploadImage={onUploadImage}
      onDeleteImage={onDeleteImage}
    />
  );
}

export default function App() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([]);
  const [token, setToken] = useState<string>(() => localStorage.getItem("admin_token") ?? "");
  const [profileDraft, setProfileDraft] = useState<Omit<Profile, "id" | "updated_at"> | null>(null);

  const isAdmin = Boolean(token);

  async function loadPublicData() {
    const [profileData, postsData, guestbookData] = await Promise.all([
      api.getProfile(),
      api.getBlogPosts(),
      api.getGuestbookEntries(),
    ]);
    setProfile(profileData);
    setPosts(postsData);
    setGuestbookEntries(guestbookData);
  }

  async function loadAdminData(accessToken: string) {
    const [profileData, postsData, guestbookData] = await Promise.all([
      api.adminGetProfile(accessToken),
      api.adminGetPosts(accessToken),
      api.adminGetGuestbook(accessToken),
    ]);
    setProfile(profileData);
    setPosts(postsData);
    setGuestbookEntries(guestbookData);
  }

  useEffect(() => {
    if (token) {
      loadAdminData(token).catch(() => {
        localStorage.removeItem("admin_token");
        setToken("");
        loadPublicData().catch(console.error);
      });
      return;
    }
    loadPublicData().catch(console.error);
  }, [token]);

  async function handleLogin(username: string, password: string) {
    const response = await api.login(username, password);
    localStorage.setItem("admin_token", response.token.access_token);
    setToken(response.token.access_token);
    navigate("/admin");
  }

  function handleLogout() {
    localStorage.removeItem("admin_token");
    setToken("");
    setProfileDraft(null);
    navigate("/");
  }

  async function handleUploadImage(file: File) {
    if (!token) throw new Error("Not authenticated");
    const result = await api.uploadImage(token, file);
    return result.url;
  }

  async function handleDeleteImage(url: string) {
    if (!token) return;
    if (!url.includes("/uploads/")) return;
    await api.deleteUploadedImage(token, url);
  }

  async function handleGuestbookSubmit(name: string, message: string) {
    await api.createGuestbookEntry(name, message);
    await loadPublicData();
  }

  function startProfileEdit() {
    if (!profile) return;
    const { id: _id, updated_at: _updatedAt, ...draft } = profile;
    setProfileDraft(draft);
  }

  function cancelProfileEdit() {
    setProfileDraft(null);
  }

  async function handleSaveProfile(payload?: Omit<Profile, "id" | "updated_at">) {
    if (!token) return;
    const nextProfile = payload ?? profileDraft;
    if (!nextProfile) return;
    await api.adminUpdateProfile(token, nextProfile);
    await loadAdminData(token);
    setProfileDraft(null);
  }

  async function handleSavePost(
    payload: Omit<BlogPost, "created_at" | "updated_at">,
    originalSlug?: string,
  ) {
    if (!token) return;
    if (originalSlug) {
      await api.adminUpdatePost(token, originalSlug, payload);
    } else {
      await api.adminCreatePost(token, payload);
    }
    await loadAdminData(token);
    navigate(`/blog/${payload.slug}`);
  }

  async function handleDeletePost(slug: string) {
    if (!token) return;
    await api.adminDeletePost(token, slug);
    await loadAdminData(token);
    navigate("/blog");
  }

  async function handleSaveGuestbook(
    entryId: number,
    payload: Pick<GuestbookEntry, "name" | "message" | "approved">,
  ) {
    if (!token) return;
    await api.adminUpdateGuestbook(token, entryId, payload);
    await loadAdminData(token);
  }

  async function handleDeleteGuestbook(entryId: number) {
    if (!token) return;
    await api.adminDeleteGuestbook(token, entryId);
    await loadAdminData(token);
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout isAdmin={isAdmin} onLogout={handleLogout} />}>
          <Route
            index
            element={
              <AboutPage
                profile={profile}
                posts={posts}
                isAdmin={isAdmin}
                isEditing={Boolean(profileDraft)}
                draft={profileDraft}
                onStartEdit={startProfileEdit}
                onCancelEdit={cancelProfileEdit}
                onSaveEdit={() => handleSaveProfile()}
                onDraftChange={setProfileDraft}
                onUploadImage={handleUploadImage}
                onDeleteImage={handleDeleteImage}
              />
            }
          />
          <Route
            path="blog"
            element={
              <BlogPage
                posts={posts}
                isAdmin={isAdmin}
                onCreate={() => navigate("/admin/blog/new")}
                onEdit={() => {}}
                onSavePost={handleSavePost}
                onDeletePost={handleDeletePost}
                onUploadImage={handleUploadImage}
                onDeleteImage={handleDeleteImage}
              />
            }
          />
          <Route
            path="blog/:slug"
            element={
              <BlogPostRoute
                posts={posts}
                isAdmin={isAdmin}
                onEdit={() => {}}
                onSavePost={handleSavePost}
                onDeletePost={handleDeletePost}
                onUploadImage={handleUploadImage}
                onDeleteImage={handleDeleteImage}
              />
            }
          />
          <Route
            path="guestbook"
            element={
              <GuestbookPage
                entries={guestbookEntries}
                isAdmin={isAdmin}
                onSubmit={handleGuestbookSubmit}
                onSaveEntry={handleSaveGuestbook}
                onDeleteEntry={handleDeleteGuestbook}
              />
            }
          />
          <Route
            path="login"
            element={isAdmin ? <Navigate to="/admin" replace /> : <LoginPage onLogin={handleLogin} />}
          />
          <Route
            path="admin"
            element={
              isAdmin ? (
                <AdminDashboard
                  onEditProfile={() => navigate("/admin/about")}
                  onCreatePost={() => navigate("/admin/blog/new")}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="admin/about"
            element={
              isAdmin ? (
                <AboutPage
                  profile={profile}
                  posts={posts}
                  isAdmin={isAdmin}
                  isEditing={Boolean(profileDraft)}
                  draft={profileDraft}
                  onStartEdit={startProfileEdit}
                  onCancelEdit={() => {
                    cancelProfileEdit();
                    navigate("/");
                  }}
                  onSaveEdit={() => handleSaveProfile()}
                  onDraftChange={setProfileDraft}
                  onUploadImage={handleUploadImage}
                  onDeleteImage={handleDeleteImage}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="admin/blog/new"
            element={
              isAdmin ? (
                <BlogEditorPage
                  onSave={handleSavePost}
                  onDelete={handleDeletePost}
                  onCancel={() => navigate("/blog")}
                  onUploadImage={handleUploadImage}
                  onDeleteImage={handleDeleteImage}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="admin/blog/:slug/edit"
            element={
              isAdmin ? (
                <BlogEditorRoute
                  posts={posts}
                  onSave={handleSavePost}
                  onDelete={handleDeletePost}
                  onCancel={() => navigate("/blog")}
                  onUploadImage={handleUploadImage}
                  onDeleteImage={handleDeleteImage}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Route>
      </Routes>

    </>
  );
}
