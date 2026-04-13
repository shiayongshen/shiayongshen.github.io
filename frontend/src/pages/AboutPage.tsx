import { useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import type { ExperienceItem, LinkItem, Profile, ProjectItem, PublicationItem } from "../lib/types";
import { MarkdownCard } from "../components/MarkdownCard";

type ProfileDraft = Omit<Profile, "id" | "updated_at">;

type AboutPageProps = {
  profile: Profile | null;
  isAdmin: boolean;
  isEditing: boolean;
  draft: ProfileDraft | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => Promise<void>;
  onDraftChange: (draft: ProfileDraft) => void;
  onUploadImage: (file: File) => Promise<string>;
  onDeleteImage: (url: string) => Promise<void>;
};

function updateArrayItem<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item));
}

export function AboutPage({
  profile,
  isAdmin,
  isEditing,
  draft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDraftChange,
  onUploadImage,
  onDeleteImage,
}: AboutPageProps) {
  const [uploadingField, setUploadingField] = useState("");
  if (!profile) {
    return <div className="panel">Loading profile...</div>;
  }

  const editable = isEditing && draft;
  const view = editable ? draft : profile;

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

  async function handleSave() {
    await onSaveEdit();
  }

  return (
    <div className="stack">
      <section className="hero">
        <aside className="hero-photo-card">
          {view.avatar_url ? (
            <img className="hero-photo" src={view.avatar_url} alt={view.full_name} />
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
          <p className="eyebrow">About</p>
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
              <h2>{view.headline}</h2>
              <div className="markdown-body intro">
                <ReactMarkdown>{view.intro_markdown}</ReactMarkdown>
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

      <div className="grid-two">
        {editable ? (
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
        ) : (
          <MarkdownCard title="Research Interests" content={view.research_interests_markdown} />
        )}
        {editable ? (
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
        ) : (
          <MarkdownCard title="Skills" content={view.skills_markdown} />
        )}
      </div>

      <div className="grid-two">
        <section className="panel">
          <div className="section-heading">
            <span>Publications</span>
          </div>
          <div className="stack">
            {view.publications.map((publication, index) => (
              <article key={`${publication.title}-${index}`} className={`publication-card${editable ? " publication-card-editing" : ""}`}>
                {editable ? (
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
                ) : (
                  <>
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
                  </>
                )}
              </article>
            ))}
            {editable ? (
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
            ) : null}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <span>Projects</span>
          </div>
          <div className="stack">
            {view.projects.map((project, index) => (
              <article key={`${project.title}-${index}`} className={`publication-card${editable ? " publication-card-editing" : ""}`}>
                {editable ? (
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
                      placeholder="Project summary"
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
                ) : (
                  <>
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
                      <p className="muted">{project.summary}</p>
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
                  </>
                )}
              </article>
            ))}
            {editable ? (
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
            ) : null}
          </div>
        </section>
      </div>

      <section className="stack">
        <div className="section-header">
          <div>
            <p className="eyebrow">Experience</p>
            <h1>Selected work</h1>
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
                      placeholder="Summary"
                    />
                  </div>
                </article>
              );
            }

            const content: ReactNode = (
              <>
                {experience.project_image_url ? (
                  <img className="experience-project-image" src={experience.project_image_url} alt={`${experience.company} project`} />
                ) : null}
                <div className="experience-top">
                  <span className="label">{experience.period}</span>
                  {experience.company_logo_url ? (
                    <img className="experience-logo" src={experience.company_logo_url} alt={`${experience.company} logo`} />
                  ) : null}
                </div>
                <h3>{experience.role}</h3>
                <strong>{experience.company}</strong>
                <p>{experience.summary}</p>
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
