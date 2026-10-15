import { PageWrapper } from "./components/PageWrapper";
import Link from "next/link";

export default function NotFound() {
  return (
    <PageWrapper>
      <>
        <h1>404 - Page not found</h1>
        <p className="mt-4">The page you are looking for does not exist.</p>
        <Link href="/">Go to startpage</Link>
      </>
    </PageWrapper>
  );
}
