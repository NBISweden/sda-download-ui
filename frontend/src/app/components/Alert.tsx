type AlertProps = {
  type:
    | "primary"
    | "info"
    | "warning"
    | "secondary"
    | "success"
    | "danger"
    | "light"
    | "dark";
  alertMessage: string;
  iconClass?: string;
};

export default function Alert({
  type: type,
  alertMessage: message,
  iconClass: iconClass,
}: AlertProps) {
  return (
    <div className={`alert alert-${type}`} role="alert">
      {iconClass && <i className={`${iconClass} fs-4 pe-1`}></i>}
      {message}
    </div>
  );
}
