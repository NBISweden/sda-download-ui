import { useCallback, useState } from "react";

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
  }, [value, setIsCopied]);
  copiedIcon = copiedIcon || "clipboard-check";
  icon = icon || "clipboard";
  icon = isCopied ? "clipboard-check" : icon;
  return (
    <span onClick={copyToClipboard} className="mx-1" role="button">
      {label ? <em>{label}</em> : <></>}
      <i className={`bi bi-${icon} ps-1`}></i>
    </span>
  );
}
