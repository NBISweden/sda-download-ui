import { useCallback, useState } from "react";
import InfoTooltip from "./InfoTooltip";

export function ClipboardValue({
  value,
  icon,
  copiedIcon,
  label,
}: {
  value: string;
  icon?: string;
  copiedIcon?: string;
  label?: string;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setIsCopied(true);
  }, [value]);
  copiedIcon = copiedIcon || "clipboard-check";
  icon = icon || "clipboard";
  const currentIcon = isCopied ? copiedIcon : icon;
  return (
    <span className="mx-1">
      {label && (
        <InfoTooltip content={value} monospace>
          <em tabIndex={0}>{label}</em>
        </InfoTooltip>
      )}
      <InfoTooltip content={isCopied ? "Copied!" : "Copy"}>
        <span
          onClick={copyToClipboard}
          className="ps-1"
          role="button"
          tabIndex={0}
        >
          <i className={`bi bi-${currentIcon}`}></i>
        </span>
      </InfoTooltip>
    </span>
  );
}
