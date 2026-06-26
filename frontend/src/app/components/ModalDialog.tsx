import { ReactNode } from "react";

type ModalProps = {
  id: string;
  title: string;
  body: ReactNode;
  action: () => void;
  iconClass: string;
  actionButtonLabel: string;
};
/**
 * Reusable Bootstrap modal dialog.
 *
 * Use `id` as the modal target, for example `#cliModal` from a button's
 * `data-bs-target`. The `title` is rendered in the modal header, `body`
 * is rendered in the modal body.
 *
 * The modal contains a close button and for the action button use action property.
 * The iconClass and actionButtonLabel add icon and label for the action button.
 */
export function ModalDialog({
  id,
  title,
  body,
  action,
  iconClass,
  actionButtonLabel,
}: ModalProps) {
  const titleId = `${id}Label`;
  return (
    <>
      <div
        className="modal fade"
        id={id}
        tabIndex={-1}
        aria-labelledby={titleId}
        aria-hidden="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id={titleId}>
                {title}
              </h1>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">{body}</div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                data-bs-dismiss="modal"
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={action}
              >
                <i className={`bi ${iconClass} me-1`}></i>
                {actionButtonLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
