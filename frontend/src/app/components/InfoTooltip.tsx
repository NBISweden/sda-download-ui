"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { type ReactNode, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

type InfoTooltipProps = {
  content: ReactNode;
  children: ReactNode;
  monospace?: boolean;
  side?: Tooltip.TooltipContentProps["side"];
};

export default function InfoTooltip({
  content,
  children,
  monospace = false,
  side,
}: InfoTooltipProps) {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!hydrated) return <>{children}</>;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className={`info-tooltip${monospace ? " info-tooltip--mono" : ""}`}
            sideOffset={6}
            side={side}
          >
            {content}
            <Tooltip.Arrow className="info-tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
