import Alert from "@/app/components/Alert";
import { LoginButton } from "@/app/components/LoginButton";

type LoginRequiredAlertProps = {
  message: string;
};

export function LoginRequiredAlert({message}: LoginRequiredAlertProps) {
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
        <LoginButton buttonText="Sign in again" />
      </div>
    </>
  );
}
