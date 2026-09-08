// components/HelpPageView.tsx
import type {
  HelpContent,
  Section,
  Paragraph,
} from "../lib/validateHelpContent";

function Heading({
  level,
  children,
}: {
  level: 2 | 3 | 4;
  children: React.ReactNode;
}) {
  switch (level) {
    case 2:
      return <h2 className="my-3">{children}</h2>;
    case 3:
      return <h3>{children}</h3>;
    case 4:
      return <h4>{children}</h4>;
  }
}

function ParagraphView({ paragraph }: { paragraph: Paragraph }) {
  if (typeof paragraph === "string") {
    return <p>{paragraph}</p>;
  }

  return (
    <>
      {paragraph.links.map((link) => (
        <p key={link.href}>
          <a href={link.href}>
            {link.text} <i className="bi bi-box-arrow-up-right mx-1" />
          </a>
        </p>
      ))}
    </>
  );
}

function SectionView({ section }: { section: Section }) {
  return (
    <>
      <Heading level={section.level}>{section.heading}</Heading>
      {section.paragraphs.map((paragraph, i) => (
        <ParagraphView key={i} paragraph={paragraph} />
      ))}
    </>
  );
}

export default function HelpPageView({ content }: { content: HelpContent }) {
  return (
    <main>
      <div className="container">
        <div className="help-page-wrapper mb-5">
          {content.sections.map((section, i) => (
            <SectionView key={i} section={section} />
          ))}
        </div>
      </div>
    </main>
  );
}
