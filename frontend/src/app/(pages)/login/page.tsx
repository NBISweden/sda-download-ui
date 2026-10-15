import Alert from "@/app/components/Alert";
import { LsaaiSignInButton } from "@/app/components/LsaaiSignInButton";

// Error types NextAuth passes to a custom sign-in page as ?error=, from its
// SignInErrorTypes union. Email and credentials provider errors are omitted:
// this app only has an OAuth provider.
const SIGN_IN_ERRORS: Record<string, string> = {
  Signin: "Unable to start the sign-in process. Please try again.",
  OAuthSignin:
    "Unable to start the sign-in process with the selected provider. Please try again.",
  OAuthCallback:
    "Unable to complete the sign-in process with the selected provider. Please try again.",
  OAuthCreateAccount:
    "Unable to create your account using the selected provider.",
  Callback: "Unable to complete the sign-in process. Please try again.",
  OAuthAccountNotLinked:
    "To confirm your identity, sign in with the same account you used originally.",
  SessionRequired: "Please sign in to access this page.",
};

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, error } = await searchParams;
  // Unrecognised values are ignored: NextAuth puts the provider id in ?error=
  // when something GETs /api/auth/signin/<provider>.
  const errorMessage = error ? (SIGN_IN_ERRORS[error] ?? null) : null;

  return (
    <main className="signin-page d-flex justify-content-center align-items-center py-5">
      <div className="signin-content text-center">
        <h1 className="visually-hidden">Sign in</h1>
        {errorMessage && (
          <Alert
            type="warning"
            alertMessage={errorMessage}
            iconClass="bi bi-exclamation-triangle-fill"
          />
        )}
        <p className="mt-4">Sign in with</p>
        <LsaaiSignInButton callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
