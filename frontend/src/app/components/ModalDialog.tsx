import { ReactNode, useCallback, useId } from "react";

type ModalProps = {
  id: string;
  title: string;
  body: ReactNode;
  closeButton?: ModalButton | null;
  buttons?: ModalButton[];
  show?: boolean;
};

type ModalButton = {
  label: string;
  action?: () => void;
  dismissModal?: boolean;
  iconClass?: string;
  buttonClass?: string;
  hidden?: boolean;
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
  closeButton,
  buttons = [],
  show,
}: ModalProps) {
  const defaultCloseButton: ModalButton = {
    label: "Close",
    dismissModal: true,
    buttonClass: "btn-secondary",
  };
  const titleId = `${id}Label`;
  closeButton =
    closeButton === undefined
      ? defaultCloseButton
      : {
          ...defaultCloseButton,
          ...(closeButton || {}),
        };
  const allButtons = [...buttons, ...(closeButton ? [closeButton] : [])];
  return (
    <>
      <div
        className={`modal fade ${show ? "show d-block" : ""}`}
        id={id}
        tabIndex={-1}
        aria-labelledby={titleId}
        {...(show ? { role: "dialog" } : { "aria-hidden": "true" })}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id={titleId}>
                {title}
              </h1>
              {closeButton &&
                (closeButton.dismissModal || closeButton.action) && (
                  <button
                    type="button"
                    className="btn-close"
                    {...(closeButton.dismissModal && !show
                      ? { "data-bs-dismiss": "modal" }
                      : {})}
                    onClick={closeButton.action}
                    aria-label={closeButton.label}
                  ></button>
                )}
            </div>
            <div className="modal-body">{body}</div>
            <div className="modal-footer">
              {allButtons
                .filter((b) => !b.hidden)
                .map(
                  (
                    { action, label, iconClass, buttonClass, dismissModal },
                    index,
                  ) => (
                    <button
                      type="button"
                      onClick={action}
                      key={index}
                      className={`btn ${buttonClass ? buttonClass : "btn-primary"}`}
                      {...(dismissModal && !show
                        ? { "data-bs-dismiss": "modal" }
                        : {})}
                    >
                      {iconClass && <i className={`bi ${iconClass} me-1`}></i>}
                      {label}
                    </button>
                  ),
                )}
            </div>
          </div>
        </div>
      </div>
      {show ? <div className="modal-backdrop fade show"></div> : <></>}
    </>
  );
}

export function useModalTrigger(id?: string): [() => void, string] {
  const createdId = useId();
  const targetId = id ? id : createdId;

  const modalTrigger = useCallback(() => {
    const buttonElement = document.createElement("button");
    const attributes = {
      class: "d-none",
      "data-bs-target": `#${targetId}`,
      "data-bs-toggle": "modal",
      "aria-hidden": "true",
    };
    for (const [key, value] of Object.entries(attributes)) {
      buttonElement.setAttribute(key, value);
    }
    document.body.appendChild(buttonElement);
    buttonElement.click();
    buttonElement.remove();
  }, [targetId]);

  return [modalTrigger, targetId];
}
