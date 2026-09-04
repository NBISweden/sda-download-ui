// app/help/page.tsx  (Server Component, App Router)
import fs from "fs";
import path from "path";
import { validateHelpContent } from "../../lib/validateHelpContent";
import HelpPageView from "@/app/components/HelpPageView";

export default function HelpPage() {
  const filePath = path.join(process.cwd(), "src", "app", "help-content.json");
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  let content;
  try {
    content = validateHelpContent(raw);
  } catch (err) {
    // Render a safe fallback instead of crashing the whole page
    return (
      <main className="container">
        <div className="alert alert-danger my-5">
          Help page content is misconfigured: {(err as Error).message}
        </div>
      </main>
    );
  }

  return <HelpPageView content={content} />;
}
