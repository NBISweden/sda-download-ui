import Alert from "@/app/components/Alert";
import { LoginButton } from "@/app/components/LoginButton";

export function LoginRequiredAlert() {
  const message ="Your session has expired or you are not signed in"

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
        <LoginButton buttonText="Sign in" />
      </div>
    </>
  );
}
