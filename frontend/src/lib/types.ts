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

export type PublicationItem = {
  title: string;
  authors: string;
  venue: string;
  year: number;
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
  experiences: ExperienceItem[];
  research_interests_markdown: string;
  publications: PublicationItem[];
  projects: ProjectItem[];
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
  created_at: string;
  updated_at: string;
};

export type GuestbookEntry = {
  id: number;
  name: string;
  message: string;
  approved: boolean;
  created_at: string;
};

export type LoginResponse = {
  token: {
    access_token: string;
    token_type: string;
  };
  username: string;
};
