import ReactMarkdown from "react-markdown";

type MarkdownCardProps = {
  title: string;
  content: string;
};

export function MarkdownCard({ title, content }: MarkdownCardProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <span>{title}</span>
      </div>
      <div className="markdown-body">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </section>
  );
}
