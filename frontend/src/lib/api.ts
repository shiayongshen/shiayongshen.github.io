import type { BlogPost, GuestbookEntry, LoginResponse, Profile } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(payload.detail ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getProfile: () => request<Profile>("/profile"),
  getBlogPosts: () => request<BlogPost[]>("/blog-posts"),
  getBlogPost: (slug: string) => request<BlogPost>(`/blog-posts/${slug}`),
  getGuestbookEntries: () => request<GuestbookEntry[]>("/guestbook"),
  createGuestbookEntry: (name: string, message: string) =>
    request<GuestbookEntry>("/guestbook", {
      method: "POST",
      body: JSON.stringify({ name, message }),
    }),
  login: async (username: string, password: string) => {
    const body = new URLSearchParams();
    body.set("username", username);
    body.set("password", password);
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  },
  adminGetProfile: (token: string) => request<Profile>("/admin/profile", undefined, token),
  adminUpdateProfile: (token: string, profile: Omit<Profile, "id" | "updated_at">) =>
    request<Profile>(
      "/admin/profile",
      { method: "PUT", body: JSON.stringify(profile) },
      token,
    ),
  adminGetPosts: (token: string) => request<BlogPost[]>("/admin/blog-posts", undefined, token),
  adminCreatePost: (token: string, post: Omit<BlogPost, "created_at" | "updated_at">) =>
    request<BlogPost>(
      "/admin/blog-posts",
      { method: "POST", body: JSON.stringify(post) },
      token,
    ),
  adminUpdatePost: (token: string, slug: string, post: Omit<BlogPost, "created_at" | "updated_at">) =>
    request<BlogPost>(
      `/admin/blog-posts/${slug}`,
      { method: "PUT", body: JSON.stringify(post) },
      token,
    ),
  adminDeletePost: (token: string, slug: string) =>
    request<void>(`/admin/blog-posts/${slug}`, { method: "DELETE" }, token),
  adminGetGuestbook: (token: string) =>
    request<GuestbookEntry[]>("/admin/guestbook", undefined, token),
  adminUpdateGuestbook: (
    token: string,
    entryId: number,
    entry: Pick<GuestbookEntry, "name" | "message" | "approved">,
  ) =>
    request<GuestbookEntry>(
      `/admin/guestbook/${entryId}`,
      { method: "PUT", body: JSON.stringify(entry) },
      token,
    ),
  adminDeleteGuestbook: (token: string, entryId: number) =>
    request<void>(`/admin/guestbook/${entryId}`, { method: "DELETE" }, token),
  uploadImage: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ url: string }>("/admin/uploads/image", { method: "POST", body: formData }, token);
  },
  deleteUploadedImage: (token: string, url: string) =>
    request<{ status: string }>(
      "/admin/uploads/image",
      { method: "DELETE", body: JSON.stringify({ url }) },
      token,
    ),
};
