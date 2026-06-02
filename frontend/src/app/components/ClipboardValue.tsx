import { useCallback, useState, type ReactNode } from "react";
import InfoTooltip from "./InfoTooltip";

export function ClipboardValue({
  value,
  icon,
  copiedIcon,
  ariaLabel,
  children,
}: {
  value: string;
  icon?: string;
  copiedIcon?: string;
  ariaLabel?: string;
  children?: ReactNode;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setIsCopied(true);
  }, [value]);

  const currentIcon = isCopied
    ? (copiedIcon ?? "clipboard-check")
    : (icon ?? "clipboard");
  const copyAriaLabel = ariaLabel ?? "Copy value to clipboard";

  return (
    <span className="mx-1">
      {children}
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
