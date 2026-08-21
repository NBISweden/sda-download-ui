"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type LoginButtonProps = {
  buttonText?: string;
};

export function LoginButton({ buttonText = "Sign in" }: LoginButtonProps) {
  // Pass the current page along so sign-in returns the user here rather than
  // to the site root, which is next-auth's default when no callbackUrl is set.
  const pathname = usePathname();
  const href =
    pathname && pathname !== "/"
      ? `/login?callbackUrl=${encodeURIComponent(pathname)}`
      : "/login";

  return (
    <Link className="btn btn-primary" href={href}>
      {buttonText}
    </Link>
  );
}
