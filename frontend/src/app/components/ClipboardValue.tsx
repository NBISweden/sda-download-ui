import { useCallback, useState } from "react";
import InfoTooltip from "./InfoTooltip";

export function ClipboardValue({
  value,
  icon,
  copiedIcon,
  label,
  truncate = false,
}: {
  value: string;
  icon?: string;
  copiedIcon?: string;
  label?: string;
  truncate?: boolean;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setIsCopied(true);
  }, [value]);
  copiedIcon = copiedIcon || "clipboard-check";
  icon = icon || "clipboard";
  const currentIcon = isCopied ? copiedIcon : icon;
  const copyAriaLabel = `Copy ${label ?? "value"} to clipboard`;
  return (
    <span className="mx-1">
      {label &&
        (truncate ? (
          <InfoTooltip content={value} monospace>
            <span className="clipboard-value-truncate" tabIndex={0}>
              {label}
            </span>
          </InfoTooltip>
        ) : (
          <InfoTooltip content={value} monospace>
            <em tabIndex={0}>{label}</em>
          </InfoTooltip>
        ))}
      <InfoTooltip content={isCopied ? "Copied!" : "Copy"}>
        <span
          onClick={copyToClipboard}
          className="ps-1"
          role="button"
          tabIndex={0}
          aria-label={copyAriaLabel}
        >
          <i className={`bi bi-${currentIcon}`} aria-hidden="true"></i>
        </span>
      </InfoTooltip>
    </span>
  );
}
