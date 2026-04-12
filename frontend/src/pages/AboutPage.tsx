import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import type { Profile } from "../lib/types";
import { MarkdownCard } from "../components/MarkdownCard";

type AboutPageProps = {
  profile: Profile | null;
  isAdmin: boolean;
  onEdit: () => void;
  editor?: ReactNode;
};

export function AboutPage({ profile, isAdmin, onEdit, editor }: AboutPageProps) {
  if (!profile) {
    return <div className="panel">Loading profile...</div>;
  }

  return (
    <div className="stack">
      <section className="hero">
        <aside className="hero-photo-card">
          {profile.avatar_url ? (
            <img className="hero-photo" src={profile.avatar_url} alt={profile.full_name} />
          ) : (
            <div className="hero-photo hero-photo-placeholder">
              <span>{profile.full_name.slice(0, 1)}</span>
            </div>
          )}
          <div className="hero-photo-meta">
            <span className="label">Profile</span>
            <p>{profile.location}</p>
            <p>{profile.email}</p>
          </div>
        </aside>
        <div className="hero-copy">
          <p className="eyebrow">About</p>
          <h1>{profile.full_name}</h1>
          <h2>{profile.headline}</h2>
          <div className="markdown-body intro">
            <ReactMarkdown>{profile.intro_markdown}</ReactMarkdown>
          </div>
          <div className="link-row">
            {profile.links.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
            <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </div>
        </div>
        <aside className="hero-card">
          <span className="label">Profile</span>
          <p>Updated {new Date(profile.updated_at).toLocaleDateString()}</p>
          {isAdmin ? (
            <button className="primary-button" onClick={onEdit}>
              Edit Profile
            </button>
          ) : null}
        </aside>
      </section>

      <div className="grid-two">
        <MarkdownCard title="Research Interests" content={profile.research_interests_markdown} />
        <MarkdownCard title="Skills" content={profile.skills_markdown} />
      </div>

      <div className="grid-two">
        <section className="panel">
          <div className="section-heading">
            <span>Publications</span>
          </div>
          <div className="stack">
            {profile.publications.map((publication, index) => (
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
                    <a
                      href={publication.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="publication-title-link"
                    >
                      {publication.title}
                    </a>
                  ) : (
                    <h3>{publication.title}</h3>
                  )}
                  <p className="muted">{publication.authors}</p>
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
        <section className="panel">
          <div className="section-heading">
            <span>Projects</span>
          </div>
          <div className="stack">
            {profile.projects.map((project, index) => (
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
                    <a
                      href={project.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="publication-title-link"
                    >
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
              </article>
            ))}
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
          {profile.experiences.map((experience) =>
            experience.story_slug ? (
              <Link
                key={`${experience.company}-${experience.period}`}
                to={`/blog/${experience.story_slug}`}
                className="experience-card"
              >
                {experience.project_image_url ? (
                  <img
                    className="experience-project-image"
                    src={experience.project_image_url}
                    alt={`${experience.company} project`}
                  />
                ) : null}
                <div className="experience-top">
                  <span className="label">{experience.period}</span>
                  {experience.company_logo_url ? (
                    <img
                      className="experience-logo"
                      src={experience.company_logo_url}
                      alt={`${experience.company} logo`}
                    />
                  ) : null}
                </div>
                <h3>{experience.role}</h3>
                <strong>{experience.company}</strong>
                <p>{experience.summary}</p>
                <span className="primary-link">Read reflection</span>
              </Link>
            ) : (
              <article key={`${experience.company}-${experience.period}`} className="experience-card">
                {experience.project_image_url ? (
                  <img
                    className="experience-project-image"
                    src={experience.project_image_url}
                    alt={`${experience.company} project`}
                  />
                ) : null}
                <div className="experience-top">
                  <span className="label">{experience.period}</span>
                  {experience.company_logo_url ? (
                    <img
                      className="experience-logo"
                      src={experience.company_logo_url}
                      alt={`${experience.company} logo`}
                    />
                  ) : null}
                </div>
                <h3>{experience.role}</h3>
                <strong>{experience.company}</strong>
                <p>{experience.summary}</p>
              </article>
            ),
          )}
        </div>
      </section>

      {editor}
    </div>
  );
}
