"use client";

import { ReactNode } from "react";
import InfoTooltip from "./InfoTooltip";

type DropdownItem = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: ReactNode; // tooltip, shown only while disabled
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
        className="btn btn-primary dropdown-toggle me-3"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        disabled={disabled}
      >
        {label}
      </button>

      <ul className="dropdown-menu">
        {items.map((item) => {
          const modalAttributes =
            item.modalTarget && !item.disabled
              ? {
                  "data-bs-toggle": "modal",
                  "data-bs-target": item.modalTarget,
                }
              : {};

          const button = (
            <button
              type="button"
              // We use custom styles to let the button appear disabled
              // because the disabled prop would block the tooltip on hover.
              className="dropdown-item"
              onClick={item.disabled ? undefined : item.onClick}
              aria-disabled={item.disabled || undefined}
              {...modalAttributes}
            >
              {item.label}
            </button>
          );

          return (
            <>
              <li key={item.label}>
                {item.disabled && item.disabledReason ? (
                  <InfoTooltip content={item.disabledReason} side="right">
                    {button}
                  </InfoTooltip>
                ) : (
                  button
                )}
              </li>
            </>
          );
        })}
      </ul>
    </div>
  );
}
