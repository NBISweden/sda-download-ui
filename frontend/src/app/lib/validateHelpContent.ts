// lib/help-content.ts

export type Link = { text: string; href: string };
export type Paragraph = string | { links: Link[] };
export type Section = {
  level: 2 | 3 | 4;
  heading: string;
  paragraphs: Paragraph[];
};
export type HelpContent = { sections: Section[] };

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateLink(value: unknown, path: string): Link {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${path}: expected an object`);
  }
  const obj = value as Record<string, unknown>;

  if (!isString(obj.text)) {
    throw new Error(`${path}.text: expected a string`);
  }
  if (!isString(obj.href) || !isValidUrl(obj.href)) {
    throw new Error(`${path}.href: expected a valid URL`);
  }

  return { text: obj.text, href: obj.href };
}

function validateParagraph(value: unknown, path: string): Paragraph {
  if (isString(value)) {
    return value;
  }

  if (typeof value !== "object" || value === null) {
    throw new Error(`${path}: expected a string or a { links } object`);
  }
  const obj = value as Record<string, unknown>;

  if (!Array.isArray(obj.links) || obj.links.length === 0) {
    throw new Error(`${path}.links: expected a non-empty array`);
  }

  const links = obj.links.map((link, i) =>
    validateLink(link, `${path}.links[${i}]`),
  );

  return { links };
}

function validateSection(value: unknown, path: string): Section {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${path}: expected an object`);
  }
  const obj = value as Record<string, unknown>;

  if (obj.level !== 2 && obj.level !== 3 && obj.level !== 4) {
    throw new Error(
      `${path}.level: expected 2, 3, or 4, got ${JSON.stringify(obj.level)}`,
    );
  }
  if (!isString(obj.heading)) {
    throw new Error(`${path}.heading: expected a string`);
  }
  if (!Array.isArray(obj.paragraphs)) {
    throw new Error(`${path}.paragraphs: expected an array`);
  }

  const paragraphs = obj.paragraphs.map((p, i) =>
    validateParagraph(p, `${path}.paragraphs[${i}]`),
  );

  return { level: obj.level, heading: obj.heading, paragraphs };
}

export function validateHelpContent(value: unknown): HelpContent {
  if (typeof value !== "object" || value === null) {
    throw new Error("help-content.json: expected an object at the root");
  }
  const obj = value as Record<string, unknown>;

  if (!Array.isArray(obj.sections)) {
    throw new Error("help-content.json: expected a `sections` array");
  }

  const sections = obj.sections.map((s, i) =>
    validateSection(s, `sections[${i}]`),
  );

  return { sections };
}
