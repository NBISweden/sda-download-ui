import { ReactNode } from "react";

type ModalProps = {
  id: string;
  title: string;
  body: ReactNode;
  showCloseButton?: boolean;
  showActionButton?: boolean;
  action?: () => void;
  iconClass?: string;
  actionButtonLabel?: string;
};
/**
 * Reusable Bootstrap modal dialog.
 *
 * Use `id` as the modal target, for example `#cliModal` from a button's
 * `data-bs-target`. The `title` is rendered in the modal header, `body`
 * is rendered in the modal body.
 *
 * The footer contents are controlled by `showCloseButton` and
 * `showActionButton`, both of which default to `true`. When the close
 * button is hidden, the header "×" is hidden too, so the modal can't be
 * dismissed by either affordance. The action button uses `iconClass`
 * (optional) and `actionButtonLabel`, and calls `action` on click.
 */
export function ModalDialog({
  id,
  title,
  body,
  showCloseButton = true,
  showActionButton = true,
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
              {showCloseButton && (
                <button
                  type="button"
                  className="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              )}
            </div>
            <div className="modal-body">{body}</div>
            <div className="modal-footer">
              {showCloseButton && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-bs-dismiss="modal"
                >
                  Close
                </button>
              )}
              {showActionButton && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={action}
                >
                  {iconClass && <i className={`bi ${iconClass} me-1`}></i>}
                  {actionButtonLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
