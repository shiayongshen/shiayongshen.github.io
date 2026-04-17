from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UploadDeleteRequest(BaseModel):
    url: str


class LoginResponse(BaseModel):
    token: TokenResponse
    username: str


class LinkItem(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    url: str = Field(min_length=1, max_length=2048)


class ExperienceItem(BaseModel):
    company: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=120)
    period: str = Field(min_length=1, max_length=120)
    summary: str = Field(min_length=1, max_length=1500)
    company_logo_url: str = ""
    project_image_url: str = ""
    story_slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class EducationItem(BaseModel):
    period: str = Field(min_length=1, max_length=120)
    school: str = Field(min_length=1, max_length=200)
    school_logo_url: str = ""
    department_name: str = Field(default="", max_length=200)
    lab_name: str = Field(default="", max_length=200)
    thesis_title: str = Field(default="", max_length=500)


class PublicationItem(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    authors: str = Field(min_length=1, max_length=800)
    venue: str = Field(min_length=1, max_length=300)
    year: int = Field(ge=1900, le=2100)
    award: str = Field(default="", max_length=500)
    external_url: str = ""
    blog_slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class ProjectItem(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    summary: str = Field(min_length=1, max_length=1500)
    period: str = Field(min_length=1, max_length=120)
    external_url: str = ""
    blog_slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class ProfileBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    headline: str = Field(min_length=1, max_length=200)
    intro_markdown: str
    location: str = Field(min_length=1, max_length=120)
    email: EmailStr
    avatar_url: str = ""
    links: list[LinkItem] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    experiences: list[ExperienceItem] = Field(default_factory=list)
    research_interests_markdown: str = ""
    publications: list[PublicationItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    overview_section_order: list[str] = Field(
        default_factory=lambda: ["research_interests", "skills", "publications", "projects"]
    )
    skills_markdown: str


class ProfileRead(ProfileBase):
    id: int
    updated_at: datetime


class ProfileUpdate(ProfileBase):
    pass


class BlogPostBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    summary: str = Field(min_length=1, max_length=280)
    category: str = Field(min_length=1, max_length=80)
    cover_image_url: str = ""
    content_markdown: str
    tags: list[str] = Field(default_factory=list)
    published: bool = True


class BlogPostCreate(BlogPostBase):
    created_at: datetime | None = None


class BlogPostUpdate(BlogPostBase):
    created_at: datetime | None = None


class BlogPostRead(BlogPostBase):
    view_count: int
    like_count: int
    created_at: datetime
    updated_at: datetime


class BlogCommentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=1000)


class BlogCommentUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=1000)
    approved: bool


class BlogCommentRead(BaseModel):
    id: int
    post_slug: str
    name: str
    message: str
    approved: bool
    created_at: datetime


class BlogPostMetricResponse(BaseModel):
    view_count: int
    like_count: int


class AssistantSkillCardRead(BaseModel):
    id: int
    skill_name: str
    skill_type: str
    summary: str
    tags: list[str]
    evidence_points: list[str]
    url: str


class AssistantRelatedLink(BaseModel):
    title: str
    url: str
    type: str


class AssistantConversationTurn(BaseModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    text: str = Field(min_length=1, max_length=4000)


class AskAssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    history: list[AssistantConversationTurn] = Field(default_factory=list, max_length=12)
    session_id: str | None = Field(default=None, max_length=80)


class AskAssistantResponse(BaseModel):
    answer: str
    show_sources: bool = True
    selected_skills: list[AssistantSkillCardRead]
    related_links: list[AssistantRelatedLink]


class AssistantConversationTurnRead(BaseModel):
    id: int
    turn_index: int
    question: str
    answer: str
    show_sources: bool
    model_name: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    usage_source: str
    prompt_versions: dict[str, int]
    selected_skills: list[AssistantSkillCardRead]
    related_links: list[AssistantRelatedLink]
    history: list[AssistantConversationTurn]
    created_at: datetime


class AssistantConversationSessionRead(BaseModel):
    id: int
    session_id: str
    title: str
    first_question: str
    last_question: str
    last_answer_preview: str
    last_model_name: str
    last_latency_ms: int
    last_input_tokens: int
    last_output_tokens: int
    last_total_tokens: int
    last_prompt_versions: dict[str, int]
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    turn_count: int
    created_at: datetime
    updated_at: datetime


class AssistantConversationSessionDetail(AssistantConversationSessionRead):
    turns: list[AssistantConversationTurnRead]


class PromptTemplateRead(BaseModel):
    id: int
    prompt_key: str
    title: str
    description: str
    content: str
    version: int
    enabled: bool
    created_at: datetime
    updated_at: datetime


class PromptTemplateUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    content: str = Field(min_length=1, max_length=12000)
    enabled: bool = True


class PromptTestTemplateInput(BaseModel):
    prompt_key: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    content: str = Field(min_length=1, max_length=12000)
    enabled: bool = True


class PromptTestRunnerRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    history: list[AssistantConversationTurn] = Field(default_factory=list, max_length=12)
    prompts: list[PromptTestTemplateInput] = Field(default_factory=list, max_length=8)
    limit: int = Field(default=4, ge=1, le=8)


class PromptTestRunnerResponse(AskAssistantResponse):
    model_name: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    usage_source: str
    latency_ms: int
    prompt_versions: dict[str, int]


class GuestbookCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=1000)


class GuestbookUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=1000)
    approved: bool


class GuestbookRead(BaseModel):
    id: int
    name: str
    message: str
    approved: bool
    created_at: datetime
