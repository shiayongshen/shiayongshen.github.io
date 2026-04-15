import { FormEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { EducationItem, ExperienceItem, LinkItem, Profile, ProjectItem, PublicationItem } from "../lib/types";

type ProfileEditorProps = {
  profile: Profile;
  onSave: (payload: Omit<Profile, "id" | "updated_at">) => Promise<void>;
  onCancel: () => void;
  onUploadImage: (file: File) => Promise<string>;
  onDeleteImage: (url: string) => Promise<void>;
};

export function ProfileEditor({
  profile,
  onSave,
  onCancel,
  onUploadImage,
  onDeleteImage,
}: ProfileEditorProps) {
  const [form, setForm] = useState({
    full_name: profile.full_name,
    headline: profile.headline,
    intro_markdown: profile.intro_markdown,
    location: profile.location,
    email: profile.email,
    avatar_url: profile.avatar_url,
    links: profile.links,
    education: profile.education,
    experiences: profile.experiences,
    research_interests_markdown: profile.research_interests_markdown,
    publications: profile.publications,
    projects: profile.projects,
    overview_section_order: profile.overview_section_order,
    skills_markdown: profile.skills_markdown,
  });
  const [uploadingField, setUploadingField] = useState("");

  function updateLink(index: number, patch: Partial<LinkItem>) {
    const links = form.links.map((link, currentIndex) =>
      currentIndex === index ? { ...link, ...patch } : link,
    );
    setForm({ ...form, links });
  }

  function updateExperience(index: number, patch: Partial<ExperienceItem>) {
    const experiences = form.experiences.map((experience, currentIndex) =>
      currentIndex === index ? { ...experience, ...patch } : experience,
    );
    setForm({ ...form, experiences });
  }

  function updateEducation(index: number, patch: Partial<EducationItem>) {
    const education = form.education.map((item, currentIndex) =>
      currentIndex === index ? { ...item, ...patch } : item,
    );
    setForm({ ...form, education });
  }

  function updatePublication(index: number, patch: Partial<PublicationItem>) {
    const publications = form.publications.map((publication, currentIndex) =>
      currentIndex === index ? { ...publication, ...patch } : publication,
    );
    setForm({ ...form, publications });
  }

  function updateProject(index: number, patch: Partial<ProjectItem>) {
    const projects = form.projects.map((project, currentIndex) =>
      currentIndex === index ? { ...project, ...patch } : project,
    );
    setForm({ ...form, projects });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(form);
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

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    setUploadingField("avatar");
    try {
      const url = await onUploadImage(file);
      setForm({ ...form, avatar_url: url });
    } finally {
      setUploadingField("");
    }
  }

  async function clearAvatar() {
    if (form.avatar_url) {
      await onDeleteImage(form.avatar_url);
    }
    setForm((current) => ({ ...current, avatar_url: "" }));
  }

  async function clearExperienceImage(index: number, field: "company_logo_url" | "project_image_url") {
    const url = form.experiences[index][field];
    if (url) {
      await onDeleteImage(url);
    }
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
    const url = form.education[index]?.school_logo_url;
    if (url) {
      await onDeleteImage(url);
    }
    updateEducation(index, { school_logo_url: "" });
  }

  return (
    <section className="panel stack">
      <div className="modal-header">
        <h2>Edit Profile</h2>
        <button className="text-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="editor-split">
        <form className="stack" onSubmit={handleSubmit}>
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input
            value={form.avatar_url}
            onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
            placeholder="Avatar URL"
          />
          <label className="upload-field">
            <span>Upload avatar</span>
            <input type="file" accept="image/*" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
            {uploadingField === "avatar" ? <small>Uploading...</small> : null}
          </label>
          {form.avatar_url ? (
            <div className="image-manager">
              <img className="image-preview image-preview-avatar" src={form.avatar_url} alt="Avatar preview" loading="lazy" />
              <button type="button" className="text-button" onClick={clearAvatar}>
                Remove avatar
              </button>
            </div>
          ) : null}
          <textarea
            rows={5}
            value={form.intro_markdown}
            onChange={(e) => setForm({ ...form, intro_markdown: e.target.value })}
          />
          <div className="section-heading">
            <span>Research Interests</span>
          </div>
          <textarea
            rows={8}
            value={form.research_interests_markdown}
            onChange={(e) => setForm({ ...form, research_interests_markdown: e.target.value })}
          />
          <div className="section-heading">
            <span>Publications</span>
          </div>
          <div className="stack">
            {form.publications.map((publication, index) => (
              <div key={`${publication.title}-${index}`} className="panel nested-panel">
                <input
                  value={publication.title}
                  onChange={(e) => updatePublication(index, { title: e.target.value })}
                  placeholder="Title"
                />
                <input
                  value={publication.authors}
                  onChange={(e) => updatePublication(index, { authors: e.target.value })}
                  placeholder="Authors"
                />
                <div className="inline-form">
                  <input
                    value={publication.venue}
                    onChange={(e) => updatePublication(index, { venue: e.target.value })}
                    placeholder="Venue"
                  />
                  <input
                    value={publication.year}
                    onChange={(e) => updatePublication(index, { year: Number(e.target.value) || new Date().getFullYear() })}
                    placeholder="Year"
                  />
                </div>
                <input
                  value={publication.award}
                  onChange={(e) => updatePublication(index, { award: e.target.value })}
                  placeholder="Award / Honor"
                />
                <div className="inline-form">
                  <input
                    value={publication.blog_slug ?? ""}
                    onChange={(e) => updatePublication(index, { blog_slug: e.target.value || null })}
                    placeholder="Linked blog slug"
                  />
                  <input
                    value={publication.external_url}
                    onChange={(e) => updatePublication(index, { external_url: e.target.value })}
                    placeholder="External URL"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setForm({
                  ...form,
                  publications: [
                    ...form.publications,
                    {
                      title: "",
                      authors: "",
                      venue: "",
                      year: new Date().getFullYear(),
                      award: "",
                      external_url: "",
                      blog_slug: null,
                    },
                  ],
                })
              }
            >
              Add Publication
            </button>
          </div>
          <div className="section-heading">
            <span>Projects</span>
          </div>
          <div className="stack">
            {form.projects.map((project, index) => (
              <div key={`${project.title}-${index}`} className="panel nested-panel">
                <input
                  value={project.title}
                  onChange={(e) => updateProject(index, { title: e.target.value })}
                  placeholder="Project title"
                />
                <div className="inline-form">
                  <input
                    value={project.period}
                    onChange={(e) => updateProject(index, { period: e.target.value })}
                    placeholder="Period"
                  />
                  <input
                    value={project.blog_slug ?? ""}
                    onChange={(e) => updateProject(index, { blog_slug: e.target.value || null })}
                    placeholder="Linked blog slug"
                  />
                </div>
                <input
                  value={project.external_url}
                  onChange={(e) => updateProject(index, { external_url: e.target.value })}
                  placeholder="External URL"
                />
                <textarea
                  rows={4}
                  value={project.summary}
                  onChange={(e) => updateProject(index, { summary: e.target.value })}
                  placeholder="Project summary"
                />
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setForm({
                  ...form,
                  projects: [
                    ...form.projects,
                    {
                      title: "",
                      summary: "",
                      period: "",
                      external_url: "",
                      blog_slug: null,
                    },
                  ],
                })
              }
            >
              Add Project
            </button>
          </div>
          <div className="section-heading">
            <span>Skills</span>
          </div>
          <textarea
            rows={8}
            value={form.skills_markdown}
            onChange={(e) => setForm({ ...form, skills_markdown: e.target.value })}
          />
          <div className="section-heading">
            <span>Education</span>
          </div>
          <div className="stack">
            {form.education.map((item, index) => (
              <div key={`${item.school}-${index}`} className="panel nested-panel">
                <div className="inline-form">
                  <input
                    value={item.period}
                    onChange={(e) => updateEducation(index, { period: e.target.value })}
                    placeholder="Period"
                  />
                  <input
                    value={item.school}
                    onChange={(e) => updateEducation(index, { school: e.target.value })}
                    placeholder="School name"
                  />
                </div>
                <div className="inline-form">
                  <input
                    value={item.school_logo_url}
                    onChange={(e) => updateEducation(index, { school_logo_url: e.target.value })}
                    placeholder="School logo URL"
                  />
                  <label className="upload-field">
                    <span>Upload logo</span>
                    <input type="file" accept="image/*" onChange={(e) => uploadEducationLogo(index, e.target.files?.[0])} />
                    {uploadingField === `education_logo-${index}` ? <small>Uploading...</small> : null}
                  </label>
                </div>
                {item.school_logo_url ? (
                  <div className="image-manager">
                    <img className="image-preview image-preview-logo" src={item.school_logo_url} alt="School logo preview" loading="lazy" />
                    <button type="button" className="text-button" onClick={() => clearEducationLogo(index)}>
                      Remove logo
                    </button>
                  </div>
                ) : null}
                <input
                  value={item.lab_name}
                  onChange={(e) => updateEducation(index, { lab_name: e.target.value })}
                  placeholder="Lab name"
                />
                <textarea
                  rows={4}
                  value={item.thesis_title}
                  onChange={(e) => updateEducation(index, { thesis_title: e.target.value })}
                  placeholder="Graduation project / thesis"
                />
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setForm({
                  ...form,
                  education: [
                    ...form.education,
                    { period: "", school: "", school_logo_url: "", lab_name: "", thesis_title: "" },
                  ],
                })
              }
            >
              Add Education
            </button>
          </div>
          <div className="stack">
            {form.experiences.map((experience, index) => (
              <div key={`${experience.company}-${index}`} className="panel nested-panel">
                <div className="inline-form">
                  <input
                    value={experience.company}
                    onChange={(e) => updateExperience(index, { company: e.target.value })}
                    placeholder="Company"
                  />
                  <input
                    value={experience.role}
                    onChange={(e) => updateExperience(index, { role: e.target.value })}
                    placeholder="Role"
                  />
                </div>
                <div className="inline-form">
                  <input
                    value={experience.period}
                    onChange={(e) => updateExperience(index, { period: e.target.value })}
                    placeholder="Period"
                  />
                  <input
                    value={experience.story_slug ?? ""}
                    onChange={(e) => updateExperience(index, { story_slug: e.target.value || null })}
                    placeholder="Linked blog slug"
                  />
                </div>
                <div className="inline-form">
                  <input
                    value={experience.company_logo_url}
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
                </div>
                {experience.company_logo_url ? (
                  <div className="image-manager">
                    <img className="image-preview image-preview-logo" src={experience.company_logo_url} alt="Company logo preview" loading="lazy" />
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => clearExperienceImage(index, "company_logo_url")}
                    >
                      Remove logo
                    </button>
                  </div>
                ) : null}
                <div className="inline-form">
                  <input
                    value={experience.project_image_url}
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
                </div>
                {experience.project_image_url ? (
                  <div className="image-manager">
                    <img className="image-preview image-preview-banner" src={experience.project_image_url} alt="Project preview" loading="lazy" />
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => clearExperienceImage(index, "project_image_url")}
                    >
                      Remove project image
                    </button>
                  </div>
                ) : null}
                <textarea
                  rows={4}
                  value={experience.summary}
                  onChange={(e) => updateExperience(index, { summary: e.target.value })}
                  placeholder="Short summary (Markdown supported)"
                />
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setForm({
                  ...form,
                  experiences: [
                    ...form.experiences,
                    {
                      company: "",
                      role: "",
                      period: "",
                      summary: "",
                      company_logo_url: "",
                      project_image_url: "",
                      story_slug: null,
                    },
                  ],
                })
              }
            >
              Add Experience Card
            </button>
          </div>
          <div className="stack">
            {form.links.map((link, index) => (
              <div key={`${link.url}-${index}`} className="inline-form">
                <input value={link.label} onChange={(e) => updateLink(index, { label: e.target.value })} />
                <input value={link.url} onChange={(e) => updateLink(index, { url: e.target.value })} />
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() => setForm({ ...form, links: [...form.links, { label: "", url: "" }] })}
            >
              Add Link
            </button>
          </div>
          <div className="action-row">
            <button className="primary-button">Save Profile</button>
            <button type="button" className="text-button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>

        <aside className="panel preview-pane">
          <div className="section-heading">
            <span>Live Preview</span>
          </div>
          <div className="stack">
            {form.avatar_url ? <img className="image-preview image-preview-avatar" src={form.avatar_url} alt={form.full_name} loading="lazy" /> : null}
            <div>
              <p className="eyebrow">{form.location}</p>
              <h2>{form.full_name}</h2>
              <p className="muted">{form.headline}</p>
            </div>
            <div className="markdown-body">
              <ReactMarkdown>{form.intro_markdown}</ReactMarkdown>
            </div>
            <div className="markdown-body">
              <ReactMarkdown>{form.research_interests_markdown}</ReactMarkdown>
            </div>
            <div className="stack">
              {form.publications.map((publication, index) => (
                <article key={`${publication.title}-${index}`} className="publication-card">
                  <div className="post-meta">
                    <span>{publication.venue || "Venue"}</span>
                    <span>{publication.year}</span>
                  </div>
                  <h3>{publication.title || "Publication title"}</h3>
                  <p className="muted">{publication.authors || "Authors"}</p>
                </article>
              ))}
            </div>
            <div className="stack">
              {form.projects.map((project, index) => (
                <article key={`${project.title}-${index}`} className="publication-card">
                  <div className="post-meta">
                    <span>{project.period || "Period"}</span>
                  </div>
                  <h3>{project.title || "Project title"}</h3>
                  <div className="markdown-body project-summary">
                    <ReactMarkdown>{project.summary || "Project summary"}</ReactMarkdown>
                  </div>
                </article>
              ))}
            </div>
            <div className="link-row">
              {form.links.filter((link) => link.label || link.url).map((link, index) => (
                <span key={`${link.url}-${index}`} className="primary-link">
                  {link.label || link.url}
                </span>
              ))}
            </div>
            <div className="stack">
              {form.education.map((item, index) => (
                <article key={`${item.school}-${index}`} className="education-card">
                  <div className="education-card-top">
                    <span className="label">{item.period || "Period"}</span>
                    {item.school_logo_url ? (
                      <img className="education-logo" src={item.school_logo_url} alt={item.school} loading="lazy" />
                    ) : null}
                  </div>
                  <h3>{item.school || "School"}</h3>
                  {item.lab_name ? <p className="education-lab">{item.lab_name}</p> : null}
                  <p className="muted">{item.thesis_title || "Graduation project / thesis"}</p>
                </article>
              ))}
            </div>
            <div className="stack">
              {form.experiences.map((experience, index) => (
                <article key={`${experience.company}-${index}`} className="experience-card preview-card">
                  {experience.project_image_url ? (
                    <img className="experience-project-image" src={experience.project_image_url} alt={experience.company} loading="lazy" />
                  ) : null}
                  <div className="experience-top">
                    <span className="label">{experience.period || "Period"}</span>
                    {experience.company_logo_url ? (
                      <img className="experience-logo" src={experience.company_logo_url} alt={experience.company} loading="lazy" />
                    ) : null}
                  </div>
                  <h3>{experience.role || "Role"}</h3>
                  <strong>{experience.company || "Company"}</strong>
                  <div className="markdown-body experience-summary">
                    <ReactMarkdown>{experience.summary || "Summary preview"}</ReactMarkdown>
                  </div>
                </article>
              ))}
            </div>
            <div className="markdown-body">
              <ReactMarkdown>{form.skills_markdown}</ReactMarkdown>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
