import type {
  AssistantConversationTurn,
  AssistantConversationSessionDetail,
  AssistantConversationSessionSummary,
  AskAssistantResponse,
  BlogComment,
  BlogPost,
  BlogPostInput,
  BlogPostMetric,
  GuestbookEntry,
  LoginResponse,
  Profile,
  PromptTemplate,
  PromptTemplateInput,
  PromptTestRunnerRequest,
  PromptTestRunnerResponse,
} from "./types";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

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
  askAssistant: (question: string, history: AssistantConversationTurn[] = [], sessionId?: string) =>
    request<AskAssistantResponse>("/ask", {
      method: "POST",
      body: JSON.stringify({ question, history, session_id: sessionId ?? null }),
    }),
  askAssistantStream: (question: string, history: AssistantConversationTurn[] = [], sessionId?: string) =>
    fetch(`${API_BASE}/ask/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history, session_id: sessionId ?? null }),
    }),
  getBlogPosts: () => request<BlogPost[]>("/blog-posts"),
  getBlogPost: (slug: string) => request<BlogPost>(`/blog-posts/${slug}`),
  getBlogComments: (slug: string) => request<BlogComment[]>(`/blog-posts/${slug}/comments`),
  createBlogComment: (slug: string, name: string, message: string) =>
    request<BlogComment>(`/blog-posts/${slug}/comments`, {
      method: "POST",
      body: JSON.stringify({ name, message }),
    }),
  trackBlogPostView: (slug: string) =>
    request<BlogPostMetric>(`/blog-posts/${slug}/view`, { method: "POST" }),
  likeBlogPost: (slug: string) =>
    request<BlogPostMetric>(`/blog-posts/${slug}/like`, { method: "POST" }),
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
  adminCreatePost: (token: string, post: BlogPostInput) =>
    request<BlogPost>(
      "/admin/blog-posts",
      { method: "POST", body: JSON.stringify(post) },
      token,
    ),
  adminUpdatePost: (token: string, slug: string, post: BlogPostInput) =>
    request<BlogPost>(
      `/admin/blog-posts/${slug}`,
      { method: "PUT", body: JSON.stringify(post) },
      token,
    ),
  adminGetBlogComments: (token: string, slug: string) =>
    request<BlogComment[]>(`/admin/blog-posts/${slug}/comments`, undefined, token),
  adminUpdateBlogComment: (
    token: string,
    slug: string,
    commentId: number,
    comment: Pick<BlogComment, "name" | "message" | "approved">,
  ) =>
    request<BlogComment>(
      `/admin/blog-posts/${slug}/comments/${commentId}`,
      { method: "PUT", body: JSON.stringify(comment) },
      token,
    ),
  adminDeleteBlogComment: (token: string, slug: string, commentId: number) =>
    request<void>(`/admin/blog-posts/${slug}/comments/${commentId}`, { method: "DELETE" }, token),
  adminSyncAssistantKnowledge: (token: string) =>
    request<{ status: string }>("/admin/assistant/sync", { method: "POST" }, token),
  adminGetPrompts: (token: string) => request<PromptTemplate[]>("/admin/prompts", undefined, token),
  adminGetPrompt: (token: string, promptKey: string) =>
    request<PromptTemplate>(`/admin/prompts/${promptKey}`, undefined, token),
  adminUpdatePrompt: (token: string, promptKey: string, prompt: PromptTemplateInput) =>
    request<PromptTemplate>(
      `/admin/prompts/${promptKey}`,
      { method: "PUT", body: JSON.stringify(prompt) },
      token,
    ),
  adminResetPrompt: (token: string, promptKey: string) =>
    request<PromptTemplate>(`/admin/prompts/${promptKey}/reset`, { method: "POST" }, token),
  adminTestPromptRunner: (token: string, payload: PromptTestRunnerRequest) =>
    request<PromptTestRunnerResponse>(
      "/admin/prompts/test",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  adminTestPromptRunnerStream: (token: string, payload: PromptTestRunnerRequest) =>
    fetch(`${API_BASE}/admin/prompts/test/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }),
  adminGetAssistantConversations: (
    token: string,
    query = "",
    limit = 50,
    startDate = "",
    endDate = "",
  ) =>
    request<AssistantConversationSessionSummary[]>(
      (() => {
        const params = new URLSearchParams();
        if (query) params.set("query", query);
        params.set("limit", String(limit));
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);
        const suffix = params.toString() ? `?${params.toString()}` : "";
        return `/admin/assistant/conversations${suffix}`;
      })(),
      undefined,
      token,
    ),
  adminGetAssistantConversation: (token: string, sessionId: string) =>
    request<AssistantConversationSessionDetail>(`/admin/assistant/conversations/${sessionId}`, undefined, token),
  adminDeleteAssistantConversation: (token: string, sessionId: string) =>
    request<void>(`/admin/assistant/conversations/${sessionId}`, { method: "DELETE" }, token),
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
