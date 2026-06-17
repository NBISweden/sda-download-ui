import Link from "next/link";

type LoginButtonProps = {
  buttonText?: string;
};

export function LoginButton({ buttonText = "Sign in" }: LoginButtonProps) {
  return (
    <Link className="btn btn-primary" href="/api/auth/signin/lsaai-oidc">
      {buttonText}
    </Link>
  );
}
