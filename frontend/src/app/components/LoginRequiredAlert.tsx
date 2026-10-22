import Alert from "@/app/components/Alert";
import { LsaaiSignInButton } from "@/app/components/LsaaiSignInButton";

export function LoginRequiredAlert() {
  const message = "Your session has expired or you are not signed in";

  return (
    <>
      <div className="col-12 col-lg-6">
        <Alert
          type="info"
          alertMessage={message}
          iconClass="bi bi-info-circle-fill"
        />
      </div>
      <div className="mt-3">
        <p className="mt-4">Sign in with</p>
        <LsaaiSignInButton />
      </div>
    </>
  );
}
