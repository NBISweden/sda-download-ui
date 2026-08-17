"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";

// The button asset is a vector with a 100:23 aspect ratio; these set the
// rendered size. Keep the ratio when changing them.
const IMAGE_WIDTH = 260;
const IMAGE_HEIGHT = 60;

type LsaaiSignInButtonProps = {
  callbackUrl?: string;
};

export function LsaaiSignInButton({ callbackUrl }: LsaaiSignInButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-link p-0 border-0"
      onClick={() =>
        signIn("lsaai-oidc", {
          callbackUrl:
            callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
              ? callbackUrl
              : "/",
        })
      }
    >
      <Image
        src="/lsaai-login-button.svg"
        alt="Sign in with LS Login"
        width={IMAGE_WIDTH}
        height={IMAGE_HEIGHT}
        // next/image refuses to run SVG through the image optimizer unless
        // dangerouslyAllowSVG is set; serve this static asset as-is instead.
        unoptimized
        priority
      />
    </button>
  );
}
