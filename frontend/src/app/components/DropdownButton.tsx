type DropdownItem = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  modalTarget?: string;
};

type DropdownButtonProps = {
  label: string;
  items: DropdownItem[];
  disabled?: boolean;
};

/**
 * Reusable Bootstrap dropdown button.
 *
 * Use `label` for the main button text and `items` for the dropdown options.
 * Each item can either trigger an `onClick` function or open a Bootstrap modal
 * by passing `modalTarget`, for example "#cliModal".
 */
export default function DropdownButton({
  label,
  items,
  disabled = false,
}: DropdownButtonProps) {
  return (
    <div className="dropdown">
      <button
        className="btn btn-outline-primary dropdown-toggle me-3"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        disabled={disabled}
      >
        {label}
      </button>

      <ul className="dropdown-menu">
        {items.map((item) => {
          const modalAttributes = item.modalTarget
            ? {
                "data-bs-toggle": "modal",
                "data-bs-target": item.modalTarget,
              }
            : {};

          return (
            <li key={item.label}>
              <button
                type="button"
                className="dropdown-item"
                onClick={item.onClick}
                disabled={item.disabled}
                {...modalAttributes}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
