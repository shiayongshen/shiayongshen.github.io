import ReactMarkdown from "react-markdown";

type MarkdownCardProps = {
  title: string;
  content: string;
  className?: string;
};

export function MarkdownCard({ title, content, className = "" }: MarkdownCardProps) {
  return (
    <section className={`panel${className ? ` ${className}` : ""}`}>
      <div className="section-heading">
        <span>{title}</span>
      </div>
      <div className="markdown-body">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </section>
  );
}
