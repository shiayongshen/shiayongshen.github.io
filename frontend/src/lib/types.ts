export type LinkItem = {
  label: string;
  url: string;
};

export type ExperienceItem = {
  company: string;
  role: string;
  period: string;
  summary: string;
  company_logo_url: string;
  project_image_url: string;
  story_slug: string | null;
};

export type EducationItem = {
  period: string;
  school: string;
  school_logo_url: string;
  department_name: string;
  lab_name: string;
  thesis_title: string;
};

export type PublicationItem = {
  title: string;
  authors: string;
  venue: string;
  year: number;
  award: string;
  external_url: string;
  blog_slug: string | null;
};

export type ProjectItem = {
  title: string;
  summary: string;
  period: string;
  external_url: string;
  blog_slug: string | null;
};

export type Profile = {
  id: number;
  full_name: string;
  headline: string;
  intro_markdown: string;
  location: string;
  email: string;
  avatar_url: string;
  links: LinkItem[];
  education: EducationItem[];
  experiences: ExperienceItem[];
  research_interests_markdown: string;
  publications: PublicationItem[];
  projects: ProjectItem[];
  overview_section_order: string[];
  skills_markdown: string;
  updated_at: string;
};

export type BlogPost = {
  title: string;
  slug: string;
  summary: string;
  category: string;
  cover_image_url: string;
  content_markdown: string;
  tags: string[];
  published: boolean;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
};

export type BlogPostInput = Omit<BlogPost, "created_at" | "updated_at" | "view_count" | "like_count">;

export type BlogComment = {
  id: number;
  post_slug: string;
  name: string;
  message: string;
  approved: boolean;
  created_at: string;
};

export type BlogPostMetric = {
  view_count: number;
  like_count: number;
};

export type AssistantSkillCard = {
  id: number;
  skill_name: string;
  skill_type: string;
  summary: string;
  tags: string[];
  evidence_points: string[];
  url: string;
};

export type AssistantRelatedLink = {
  title: string;
  url: string;
  type: string;
};

export type AskAssistantResponse = {
  answer: string;
  show_sources: boolean;
  selected_skills: AssistantSkillCard[];
  related_links: AssistantRelatedLink[];
};

export type AssistantConversationTurn = {
  role: "user" | "assistant";
  text: string;
};

export type AssistantConversationTurnRecord = {
  id: number;
  turn_index: number;
  question: string;
  answer: string;
  show_sources: boolean;
  model_name: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  usage_source: string;
  prompt_versions: Record<string, number>;
  selected_skills: AssistantSkillCard[];
  related_links: AssistantRelatedLink[];
  history: AssistantConversationTurn[];
  created_at: string;
};

export type AssistantConversationSessionSummary = {
  id: number;
  session_id: string;
  title: string;
  first_question: string;
  last_question: string;
  last_answer_preview: string;
  last_model_name: string;
  last_latency_ms: number;
  last_input_tokens: number;
  last_output_tokens: number;
  last_total_tokens: number;
  last_prompt_versions: Record<string, number>;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  turn_count: number;
  created_at: string;
  updated_at: string;
};

export type AssistantConversationSessionDetail = AssistantConversationSessionSummary & {
  turns: AssistantConversationTurnRecord[];
};

export type GuestbookEntry = {
  id: number;
  name: string;
  message: string;
  approved: boolean;
  created_at: string;
};

export type PromptTemplate = {
  id: number;
  prompt_key: string;
  title: string;
  description: string;
  content: string;
  version: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type PromptTemplateInput = {
  title: string;
  description: string;
  content: string;
  enabled: boolean;
};

export type PromptTestTemplateInput = PromptTemplateInput & {
  prompt_key: string;
};

export type PromptTestRunnerRequest = {
  question: string;
  history: AssistantConversationTurn[];
  prompts: PromptTestTemplateInput[];
  limit: number;
};

export type PromptTestRunnerResponse = AskAssistantResponse & {
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  usage_source: string;
  latency_ms: number;
  prompt_versions: Record<string, number>;
};

export type LoginResponse = {
  token: {
    access_token: string;
    token_type: string;
  };
  username: string;
};
