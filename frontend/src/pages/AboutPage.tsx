import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import type { BlogPost, EducationItem, ExperienceItem, LinkItem, Profile, ProjectItem, PublicationItem } from "../lib/types";
import { AskVincentPanel } from "../components/AskVincentPanel";
import { MarkdownCard } from "../components/MarkdownCard";
import { Seo } from "../components/Seo";

type ProfileDraft = Omit<Profile, "id" | "updated_at">;
type OverviewSectionId = "research_interests" | "skills" | "publications" | "projects";
type OverviewSection = {
  id: OverviewSectionId;
  title: string;
};

const DEFAULT_OVERVIEW_SECTION_ORDER: OverviewSectionId[] = [
  "research_interests",
  "skills",
  "publications",
  "projects",
];

const OVERVIEW_SECTIONS: OverviewSection[] = [
  { id: "research_interests", title: "Research Interests" },
  { id: "skills", title: "Skills" },
  { id: "publications", title: "Publications" },
  { id: "projects", title: "Projects" },
];

function normalizeOverviewSectionOrder(order: string[] | undefined): OverviewSectionId[] {
  const unique = new Set<OverviewSectionId>();
  for (const item of order ?? []) {
    if (DEFAULT_OVERVIEW_SECTION_ORDER.includes(item as OverviewSectionId)) {
      unique.add(item as OverviewSectionId);
    }
  }
  for (const item of DEFAULT_OVERVIEW_SECTION_ORDER) {
    unique.add(item);
  }
  return Array.from(unique);
}

function moveOverviewSection(
  order: OverviewSectionId[],
  fromId: OverviewSectionId,
  toId: OverviewSectionId,
): OverviewSectionId[] {
  if (fromId === toId) return order;
  const next = [...order];
  const fromIndex = next.indexOf(fromId);
  const toIndex = next.indexOf(toId);
  if (fromIndex === -1 || toIndex === -1) return order;
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

type AboutPageProps = {
  profile: Profile | null;
  posts: BlogPost[];
  isAdmin: boolean;
  isEditing: boolean;
  draft: ProfileDraft | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => Promise<void>;
  onDraftChange: (draft: ProfileDraft) => void;
  onUploadImage: (file: File) => Promise<string>;
  onDeleteImage: (url: string) => Promise<void>;
  seoPath?: string;
  seoRobots?: string;
};

function updateArrayItem<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item));
}

export function AboutPage({
  profile,
  posts,
  isAdmin,
  isEditing,
  draft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDraftChange,
  onUploadImage,
  onDeleteImage,
  seoPath = "/",
  seoRobots = "index,follow",
}: AboutPageProps) {
  const [uploadingField, setUploadingField] = useState("");
  const [draggedSectionId, setDraggedSectionId] = useState<OverviewSectionId | null>(null);
  const [showLandingIntro, setShowLandingIntro] = useState(() => {
    if (typeof window === "undefined" || isEditing) return false;
    return window.sessionStorage.getItem("home_intro_seen") !== "true";
  });
  const [isLandingIntroClosing, setIsLandingIntroClosing] = useState(false);
  const editable = isEditing && draft;
  const view = profile ? (editable ? draft : profile) : null;
  const latestPosts = posts.filter((post) => post.published).slice(0, 3);
  const overviewSectionOrder = normalizeOverviewSectionOrder(view?.overview_section_order);
  const seoTitle = `${view?.full_name ?? "Vincent Hsia"} | AI-empowered Engineer`;
  const seoDescription =
    view?.headline ||
    "AI-empowered engineer building useful systems, writing technical notes, and turning ideas into shipped products.";

  useEffect(() => {
    if (editable || !showLandingIntro) return;
    function dismissIntro() {
      setIsLandingIntroClosing(true);
      window.sessionStorage.setItem("home_intro_seen", "true");
      window.setTimeout(() => {
        setShowLandingIntro(false);
        setIsLandingIntroClosing(false);
      }, 720);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchmove", dismissIntro);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    }

    function handleWheel(event: WheelEvent) {
      if (Math.abs(event.deltaY) > 0) dismissIntro();
    }

    function handleScroll() {
      if (window.scrollY > 0) dismissIntro();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (["ArrowDown", "PageDown", "Space", "Home", "End"].includes(event.code)) {
        dismissIntro();
      }
    }

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchmove", dismissIntro, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchmove", dismissIntro);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editable, showLandingIntro]);

  if (!profile || !view) {
    return <div className="panel">Loading profile...</div>;
  }
  const currentView = view;

  function updateField<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    if (!draft) return;
    onDraftChange({ ...draft, [key]: value });
  }

  function updateLink(index: number, patch: Partial<LinkItem>) {
    if (!draft) return;
    updateField("links", updateArrayItem(draft.links, index, patch));
  }

  function updatePublication(index: number, patch: Partial<PublicationItem>) {
    if (!draft) return;
    updateField("publications", updateArrayItem(draft.publications, index, patch));
  }

  function updateProject(index: number, patch: Partial<ProjectItem>) {
    if (!draft) return;
    updateField("projects", updateArrayItem(draft.projects, index, patch));
  }

  function updateExperience(index: number, patch: Partial<ExperienceItem>) {
    if (!draft) return;
    updateField("experiences", updateArrayItem(draft.experiences, index, patch));
  }

  function updateEducation(index: number, patch: Partial<EducationItem>) {
    if (!draft) return;
    updateField("education", updateArrayItem(draft.education, index, patch));
  }

  function updateOverviewSectionOrder(nextOrder: OverviewSectionId[]) {
    if (!draft) return;
    updateField("overview_section_order", nextOrder);
  }

  function renderOverviewEditSection(sectionId: OverviewSectionId) {
    if (!draft) return null;

    if (sectionId === "research_interests") {
      return (
        <section className="panel stack">
          <div className="section-heading">
            <span>Research Interests</span>
          </div>
          <textarea
            className="inline-edit-textarea"
            rows={10}
            value={draft.research_interests_markdown}
            onChange={(e) => updateField("research_interests_markdown", e.target.value)}
          />
        </section>
      );
    }

    if (sectionId === "skills") {
      return (
        <section className="panel stack">
          <div className="section-heading">
            <span>Skills</span>
          </div>
          <textarea
            className="inline-edit-textarea"
            rows={10}
            value={draft.skills_markdown}
            onChange={(e) => updateField("skills_markdown", e.target.value)}
          />
        </section>
      );
    }

    if (sectionId === "publications") {
      return (
        <section className="panel">
          <div className="section-heading">
            <span>Publications</span>
          </div>
          <div className="stack">
            {currentView.publications.map((publication, index) => (
              <article key={`${publication.title}-${index}`} className="publication-card publication-card-editing">
                <div className="stack inline-edit-stack">
                  <div className="inline-form">
                    <input
                      value={draft.publications[index].venue}
                      onChange={(e) => updatePublication(index, { venue: e.target.value })}
                      placeholder="Venue"
                    />
                    <input
                      value={draft.publications[index].year}
                      onChange={(e) => updatePublication(index, { year: Number(e.target.value) || new Date().getFullYear() })}
                      placeholder="Year"
                    />
                  </div>
                  <input
                    value={draft.publications[index].title}
                    onChange={(e) => updatePublication(index, { title: e.target.value })}
                    placeholder="Title"
                  />
                  <input
                    value={draft.publications[index].authors}
                    onChange={(e) => updatePublication(index, { authors: e.target.value })}
                    placeholder="Authors"
                  />
                  <input
                    value={draft.publications[index].award}
                    onChange={(e) => updatePublication(index, { award: e.target.value })}
                    placeholder="Award / Honor"
                  />
                  <div className="inline-form">
                    <input
                      value={draft.publications[index].blog_slug ?? ""}
                      onChange={(e) => updatePublication(index, { blog_slug: e.target.value || null })}
                      placeholder="Linked blog slug"
                    />
                    <input
                      value={draft.publications[index].external_url}
                      onChange={(e) => updatePublication(index, { external_url: e.target.value })}
                      placeholder="External URL"
                    />
                  </div>
                </div>
              </article>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                updateField("publications", [
                  ...draft.publications,
                  { title: "", authors: "", venue: "", year: new Date().getFullYear(), award: "", external_url: "", blog_slug: null },
                ])
              }
            >
              Add Publication
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="panel">
        <div className="section-heading">
          <span>Projects</span>
        </div>
        <div className="stack">
          {currentView.projects.map((project, index) => (
            <article key={`${project.title}-${index}`} className="publication-card publication-card-editing">
              <div className="stack inline-edit-stack">
                <div className="inline-form">
                  <input
                    value={draft.projects[index].title}
                    onChange={(e) => updateProject(index, { title: e.target.value })}
                    placeholder="Project title"
                  />
                  <input
                    value={draft.projects[index].period}
                    onChange={(e) => updateProject(index, { period: e.target.value })}
                    placeholder="Period"
                  />
                </div>
                <textarea
                  className="inline-edit-textarea"
                  rows={5}
                  value={draft.projects[index].summary}
                  onChange={(e) => updateProject(index, { summary: e.target.value })}
                  placeholder="Project summary (Markdown supported)"
                />
                <div className="inline-form">
                  <input
                    value={draft.projects[index].blog_slug ?? ""}
                    onChange={(e) => updateProject(index, { blog_slug: e.target.value || null })}
                    placeholder="Linked blog slug"
                  />
                  <input
                    value={draft.projects[index].external_url}
                    onChange={(e) => updateProject(index, { external_url: e.target.value })}
                    placeholder="External URL"
                  />
                </div>
              </div>
            </article>
          ))}
          <button
            type="button"
            className="text-button"
            onClick={() =>
              updateField("projects", [
                ...draft.projects,
                { title: "", summary: "", period: "", external_url: "", blog_slug: null },
              ])
            }
          >
            Add Project
          </button>
        </div>
      </section>
    );
  }

  function renderOverviewDisplaySection(sectionId: OverviewSectionId) {
    if (sectionId === "research_interests") {
      return <MarkdownCard title="Research Interests" content={currentView.research_interests_markdown} />;
    }
    if (sectionId === "skills") {
      return <MarkdownCard title="Skills" content={currentView.skills_markdown} />;
    }
    if (sectionId === "publications") {
      return (
        <section className="panel">
          <div className="section-heading">
            <span>Publications</span>
          </div>
          <div className="stack">
            {currentView.publications.map((publication, index) => (
              <article key={`${publication.title}-${index}`} className="publication-card">
                <div className="stack publication-copy">
                  <div className="post-meta">
                    <span>{publication.venue}</span>
                    <span>{publication.year}</span>
                  </div>
                  {publication.blog_slug ? (
                    <Link to={`/blog/${publication.blog_slug}`} className="publication-title-link">
                      {publication.title}
                    </Link>
                  ) : publication.external_url ? (
                    <a href={publication.external_url} target="_blank" rel="noreferrer" className="publication-title-link">
                      {publication.title}
                    </a>
                  ) : (
                    <h3>{publication.title}</h3>
                  )}
                  <p className="muted">{publication.authors}</p>
                  {publication.award ? <p className="award-badge">{publication.award}</p> : null}
                </div>
                <div className="action-row">
                  {publication.blog_slug ? (
                    <Link to={`/blog/${publication.blog_slug}`} className="primary-link">
                      Read note
                    </Link>
                  ) : null}
                  {publication.external_url ? (
                    <a href={publication.external_url} target="_blank" rel="noreferrer" className="primary-link">
                      External
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      );
    }
    return (
      <section className="panel">
        <div className="section-heading">
          <span>Projects</span>
        </div>
        <div className="stack">
          {currentView.projects.map((project, index) => (
            <article key={`${project.title}-${index}`} className="publication-card">
              <div className="stack publication-copy">
                <div className="post-meta">
                  <span>{project.period}</span>
                </div>
                {project.blog_slug ? (
                  <Link to={`/blog/${project.blog_slug}`} className="publication-title-link">
                    {project.title}
                  </Link>
                ) : project.external_url ? (
                  <a href={project.external_url} target="_blank" rel="noreferrer" className="publication-title-link">
                    {project.title}
                  </a>
                ) : (
                  <h3>{project.title}</h3>
                )}
                <div className="markdown-body project-summary">
                  <ReactMarkdown>{project.summary}</ReactMarkdown>
                </div>
              </div>
              <div className="action-row">
                {project.blog_slug ? (
                  <Link to={`/blog/${project.blog_slug}`} className="primary-link">
                    Read note
                  </Link>
                ) : null}
                {project.external_url ? (
                  <a href={project.external_url} target="_blank" rel="noreferrer" className="primary-link">
                    External
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  async function uploadAvatar(file: File | undefined) {
    if (!draft || !file) return;
    setUploadingField("avatar");
    try {
      const url = await onUploadImage(file);
      updateField("avatar_url", url);
    } finally {
      setUploadingField("");
    }
  }

  async function clearAvatar() {
    if (!draft?.avatar_url) return;
    await onDeleteImage(draft.avatar_url);
    updateField("avatar_url", "");
  }

  async function uploadExperienceImage(
    index: number,
    field: "company_logo_url" | "project_image_url",
    file: File | undefined,
  ) {
    if (!file) return;
    setUploadingField(`${field}-${index}`);
    try {
      const url = await onUploadImage(file);
      updateExperience(index, { [field]: url });
    } finally {
      setUploadingField("");
    }
  }

  async function clearExperienceImage(index: number, field: "company_logo_url" | "project_image_url") {
    if (!draft) return;
    const url = draft.experiences[index][field];
    if (!url) return;
    await onDeleteImage(url);
    updateExperience(index, { [field]: "" });
  }

  async function uploadEducationLogo(index: number, file: File | undefined) {
    if (!file) return;
    setUploadingField(`education_logo-${index}`);
    try {
      const url = await onUploadImage(file);
      updateEducation(index, { school_logo_url: url });
    } finally {
      setUploadingField("");
    }
  }

  async function clearEducationLogo(index: number) {
    if (!draft) return;
    const url = draft.education[index]?.school_logo_url;
    if (!url) return;
    await onDeleteImage(url);
    updateEducation(index, { school_logo_url: "" });
  }

  async function handleSave() {
    await onSaveEdit();
  }

  return (
    <div className={`stack${showLandingIntro ? " home-intro-active" : ""}`}>
      <Seo
        title={seoTitle}
        description={seoDescription}
        path={seoPath}
        image={view.avatar_url || latestPosts[0]?.cover_image_url}
        robots={seoRobots}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: view.full_name,
          jobTitle: "AI-empowered Engineer",
          description: seoDescription,
          image: view.avatar_url || undefined,
          email: view.email || undefined,
          address: view.location || undefined,
          url: "/",
          sameAs: view.links.map((link) => link.url).filter(Boolean),
        }}
      />
      {showLandingIntro ? (
        <div className={`home-intro${isLandingIntroClosing ? " home-intro-closing" : ""}`} aria-hidden="true">
          <div className="home-intro-mark">VH</div>
          <p className="home-intro-kicker">Vincent Hsia</p>
          <h1>AI-empowered engineer.</h1>
          <span className="home-intro-scroll-hint">Scroll to enter</span>
        </div>
      ) : null}
      <section className="hero">
        <aside className="hero-photo-card">
          {view.avatar_url ? (
            <img className="hero-photo" src={view.avatar_url} alt={view.full_name} loading="lazy" />
          ) : (
            <div className="hero-photo hero-photo-placeholder">
              <span>{view.full_name.slice(0, 1)}</span>
            </div>
          )}
          <div className="hero-photo-meta">
            <span className="label">Profile</span>
            {editable ? (
              <div className="stack inline-edit-stack">
                <input value={draft.avatar_url} onChange={(e) => updateField("avatar_url", e.target.value)} placeholder="Avatar URL" />
                <label className="upload-field">
                  <span>Upload avatar</span>
                  <input type="file" accept="image/*" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
                  {uploadingField === "avatar" ? <small>Uploading...</small> : null}
                </label>
                {draft.avatar_url ? (
                  <button type="button" className="text-button" onClick={clearAvatar}>
                    Remove avatar
                  </button>
                ) : null}
                <input value={draft.location} onChange={(e) => updateField("location", e.target.value)} placeholder="Location" />
                <input value={draft.email} onChange={(e) => updateField("email", e.target.value)} placeholder="Email" />
              </div>
            ) : (
              <>
                <p>{view.location}</p>
                <p>{view.email}</p>
              </>
            )}
          </div>
        </aside>
        <div className="hero-copy">
          <p className="eyebrow">AI-empowered Engineer</p>
          {editable ? (
            <div className="stack inline-edit-stack">
              <input value={draft.full_name} onChange={(e) => updateField("full_name", e.target.value)} placeholder="Full name" />
              <input value={draft.headline} onChange={(e) => updateField("headline", e.target.value)} placeholder="Headline" />
              <textarea
                className="inline-edit-textarea"
                rows={8}
                value={draft.intro_markdown}
                onChange={(e) => updateField("intro_markdown", e.target.value)}
                placeholder="Intro markdown"
              />
              <div className="link-row inline-edit-links">
                {draft.links.map((link, index) => (
                  <div key={`${link.url}-${index}`} className="inline-form inline-chip-editor">
                    <input value={link.label} onChange={(e) => updateLink(index, { label: e.target.value })} placeholder="Label" />
                    <input value={link.url} onChange={(e) => updateLink(index, { url: e.target.value })} placeholder="URL" />
                  </div>
                ))}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => updateField("links", [...draft.links, { label: "", url: "" }])}
                >
                  Add Link
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1>{view.full_name}</h1>
              <h2>AI-empowered engineer building useful systems and shipping practical products.</h2>
              <div className="markdown-body intro">
                <ReactMarkdown>{view.intro_markdown}</ReactMarkdown>
              </div>
              <div className="hero-highlights">
                <span className="tag">Build with AI</span>
                <span className="tag">Ship end-to-end systems</span>
                <span className="tag">Write technical notes</span>
              </div>
              <div className="link-row">
                {view.links.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
                <a href={`mailto:${view.email}`}>{view.email}</a>
              </div>
            </>
          )}
        </div>
        <aside className="hero-card">
          <span className="label">Profile</span>
          <p>Updated {new Date(profile.updated_at).toLocaleDateString()}</p>
          {isAdmin ? (
            editable ? (
              <div className="stack">
                <button className="primary-button" onClick={handleSave}>
                  Save Changes
                </button>
                <button className="text-button" onClick={onCancelEdit}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="primary-button" onClick={onStartEdit}>
                Edit In Place
              </button>
            )
          ) : null}
        </aside>
      </section>

      <section className="panel stack">
        <div className="section-header">
          <div>
            <p className="eyebrow">Education</p>
            <h1>學歷</h1>
          </div>
        </div>
        <div className="education-grid">
          {view.education.map((item, index) =>
            editable ? (
              <article key={`${item.school}-${index}`} className="education-card education-card-editing">
                <div className="stack inline-edit-stack">
                  <div className="inline-form">
                    <input
                      value={draft.education[index].period}
                      onChange={(e) => updateEducation(index, { period: e.target.value })}
                      placeholder="年月，例如 2022.09 - 2024.06"
                    />
                    <input
                      value={draft.education[index].school}
                      onChange={(e) => updateEducation(index, { school: e.target.value })}
                      placeholder="學校名稱"
                    />
                  </div>
                  <div className="inline-form">
                    <input
                      value={draft.education[index].school_logo_url}
                      onChange={(e) => updateEducation(index, { school_logo_url: e.target.value })}
                      placeholder="School logo URL"
                    />
                    <label className="upload-field">
                      <span>Upload school logo</span>
                      <input type="file" accept="image/*" onChange={(e) => uploadEducationLogo(index, e.target.files?.[0])} />
                      {uploadingField === `education_logo-${index}` ? <small>Uploading...</small> : null}
                    </label>
                  </div>
                  {draft.education[index].school_logo_url ? (
                    <div className="image-manager">
                      <img
                        className="image-preview image-preview-logo"
                        src={draft.education[index].school_logo_url}
                        alt={`${draft.education[index].school} logo`}
                        loading="lazy"
                      />
                      <button type="button" className="text-button" onClick={() => clearEducationLogo(index)}>
                        Remove logo
                      </button>
                    </div>
                  ) : null}
                  <input
                    value={draft.education[index].lab_name}
                    onChange={(e) => updateEducation(index, { lab_name: e.target.value })}
                    placeholder="實驗室名稱"
                  />
                  <input
                    value={draft.education[index].department_name}
                    onChange={(e) => updateEducation(index, { department_name: e.target.value })}
                    placeholder="科系名稱"
                  />
                  <textarea
                    className="inline-edit-textarea"
                    rows={4}
                    value={draft.education[index].thesis_title}
                    onChange={(e) => updateEducation(index, { thesis_title: e.target.value })}
                    placeholder="畢業專題 / 論文"
                  />
                </div>
              </article>
            ) : (
              <article key={`${item.school}-${index}`} className="education-card">
                <div className="education-card-top">
                  <span className="label">{item.period}</span>
                  {item.school_logo_url ? (
                    <img className="education-logo" src={item.school_logo_url} alt={item.school} loading="lazy" />
                  ) : null}
                </div>
                <h3>{item.school}</h3>
                {item.department_name ? <p className="education-department">{item.department_name}</p> : null}
                {item.lab_name ? <p className="education-lab">{item.lab_name}</p> : null}
                {item.thesis_title ? <p className="muted">畢業專題 / 論文：{item.thesis_title}</p> : null}
              </article>
            ),
          )}
        </div>
        {editable ? (
          <button
            type="button"
            className="text-button"
            onClick={() =>
              updateField("education", [
                ...draft.education,
                { period: "", school: "", school_logo_url: "", department_name: "", lab_name: "", thesis_title: "" },
              ])
            }
          >
            Add Education
          </button>
        ) : null}
      </section>

      {!editable && latestPosts.length ? (
        <section className="panel stack">
          <div className="section-header">
            <div>
              <p className="eyebrow">Latest Writing</p>
              <h1>最近發表的文章</h1>
            </div>
            <Link to="/blog" className="primary-link">
              View all posts
            </Link>
          </div>
          <div className="latest-posts-grid">
            {latestPosts.map((post) => (
              <article key={post.slug} className="latest-post-card">
                <div className="post-meta">
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  <span>{post.category}</span>
                </div>
                <h3>
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <p className="muted">{post.summary}</p>
                <div className="tag-row">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <Link to={`/blog/${post.slug}`} className="primary-link">
                  Read article
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {editable ? (
        <section className="stack">
          <div className="section-header">
            <div>
              <p className="eyebrow">Overview Layout</p>
              <h1>拖曳調整區塊順序</h1>
            </div>
          </div>
          <div className="overview-editor-grid">
            {overviewSectionOrder.map((sectionId) => {
              const section = OVERVIEW_SECTIONS.find((item) => item.id === sectionId);
              if (!section) return null;
              return (
                <div
                  key={section.id}
                  className={`overview-editor-item${draggedSectionId === section.id ? " is-dragging" : ""}`}
                  draggable
                  onDragStart={() => setDraggedSectionId(section.id)}
                  onDragEnd={() => setDraggedSectionId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!draggedSectionId || draggedSectionId === section.id) return;
                    updateOverviewSectionOrder(moveOverviewSection(overviewSectionOrder, draggedSectionId, section.id));
                    setDraggedSectionId(null);
                  }}
                >
                  <div className="overview-editor-handle">
                    <span>{section.title}</span>
                    <small>Drag to reorder</small>
                  </div>
                  {renderOverviewEditSection(section.id)}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="overview-masonry">
          {overviewSectionOrder.map((sectionId) => (
            <div key={sectionId} className="overview-masonry-item">
              {renderOverviewDisplaySection(sectionId)}
            </div>
          ))}
        </div>
      )}

      <section className="stack">
        <div className="section-header">
          <div>
            <p className="eyebrow">Experience</p>
          </div>
        </div>
        <div className="experience-grid">
          {view.experiences.map((experience, index) => {
            if (editable) {
              return (
                <article key={`${experience.company}-${index}`} className="experience-card experience-card-editing">
                  {draft.experiences[index].project_image_url ? (
                    <img
                      className="experience-project-image"
                      src={draft.experiences[index].project_image_url}
                      alt={`${draft.experiences[index].company} project`}
                      loading="lazy"
                    />
                  ) : null}
                  <div className="stack inline-experience-form">
                    <div className="inline-form">
                      <input
                        value={draft.experiences[index].role}
                        onChange={(e) => updateExperience(index, { role: e.target.value })}
                        placeholder="Role"
                      />
                      <input
                        value={draft.experiences[index].company}
                        onChange={(e) => updateExperience(index, { company: e.target.value })}
                        placeholder="Company"
                      />
                    </div>
                    <div className="inline-form">
                      <input
                        value={draft.experiences[index].period}
                        onChange={(e) => updateExperience(index, { period: e.target.value })}
                        placeholder="Period"
                      />
                      <input
                        value={draft.experiences[index].story_slug ?? ""}
                        onChange={(e) => updateExperience(index, { story_slug: e.target.value || null })}
                        placeholder="Linked blog slug"
                      />
                    </div>
                    <input
                      value={draft.experiences[index].company_logo_url}
                      onChange={(e) => updateExperience(index, { company_logo_url: e.target.value })}
                      placeholder="Company logo URL"
                    />
                    <label className="upload-field">
                      <span>Upload logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => uploadExperienceImage(index, "company_logo_url", e.target.files?.[0])}
                      />
                      {uploadingField === `company_logo_url-${index}` ? <small>Uploading...</small> : null}
                    </label>
                    {draft.experiences[index].company_logo_url ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => clearExperienceImage(index, "company_logo_url")}
                      >
                        Remove logo
                      </button>
                    ) : null}
                    <input
                      value={draft.experiences[index].project_image_url}
                      onChange={(e) => updateExperience(index, { project_image_url: e.target.value })}
                      placeholder="Project image URL"
                    />
                    <label className="upload-field">
                      <span>Upload project image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => uploadExperienceImage(index, "project_image_url", e.target.files?.[0])}
                      />
                      {uploadingField === `project_image_url-${index}` ? <small>Uploading...</small> : null}
                    </label>
                    {draft.experiences[index].project_image_url ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => clearExperienceImage(index, "project_image_url")}
                      >
                        Remove project image
                      </button>
                    ) : null}
                    <textarea
                      className="inline-edit-textarea"
                      rows={5}
                      value={draft.experiences[index].summary}
                      onChange={(e) => updateExperience(index, { summary: e.target.value })}
                      placeholder="Summary (Markdown supported)"
                    />
                  </div>
                </article>
              );
            }

            const content: ReactNode = (
              <>
                {experience.project_image_url ? (
                  <img className="experience-project-image" src={experience.project_image_url} alt={`${experience.company} project`} loading="lazy" />
                ) : null}
                <div className="experience-top">
                  <span className="label">{experience.period}</span>
                  {experience.company_logo_url ? (
                    <img className="experience-logo" src={experience.company_logo_url} alt={`${experience.company} logo`} loading="lazy" />
                  ) : null}
                </div>
                <h3>{experience.role}</h3>
                <strong>{experience.company}</strong>
                <div className="markdown-body experience-summary">
                  <ReactMarkdown>{experience.summary}</ReactMarkdown>
                </div>
                {experience.story_slug ? <span className="primary-link">Read reflection</span> : null}
              </>
            );

            return experience.story_slug ? (
              <Link key={`${experience.company}-${experience.period}`} to={`/blog/${experience.story_slug}`} className="experience-card">
                {content}
              </Link>
            ) : (
              <article key={`${experience.company}-${experience.period}`} className="experience-card">
                {content}
              </article>
            );
          })}
        </div>
        {editable ? (
          <button
            type="button"
            className="text-button"
            onClick={() =>
              updateField("experiences", [
                ...draft.experiences,
                { company: "", role: "", period: "", summary: "", company_logo_url: "", project_image_url: "", story_slug: null },
              ])
            }
          >
            Add Experience Card
          </button>
        ) : null}
      </section>
    </div>
  );
}
