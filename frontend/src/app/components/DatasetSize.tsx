import { filesize } from "filesize";
import InfoTooltip from "./InfoTooltip";

type DatasetSizeProps = {
  size: number;
  className?: string;
};

/**
 * Human-readable dataset size with a tooltip revealing the exact byte count.
 * Shared between the card, table and details dataset views.
 */
export default function DatasetSize({
  size,
  className = "text-muted",
}: DatasetSizeProps) {
  return (
    <InfoTooltip content={`${size.toLocaleString("en-GB")} bytes`}>
      <span className={className} tabIndex={0}>
        {filesize(size)}
      </span>
    </InfoTooltip>
  );
}
