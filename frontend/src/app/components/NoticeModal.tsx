"use client";

import { useEffect, useRef } from "react";
import { ModalDialog } from "@/app/components/ModalDialog";

type NoticeModalProps = {
  id: string;
  title?: string;
  notice: { message: string } | null;
};

/**
 * ModalDialog is a Bootstrap modal that requires a button click to open.
 * This component wraps ModalDialog and triggers it by programmatically clicking a hidden button
 * whenever a new notice/error message is set.
 */

export function NoticeModal({
  id,
  title = "Notice",
  notice,
}: NoticeModalProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Open the modal whenever a new notice is set.
  useEffect(() => {
    if (notice) {
      triggerRef.current?.click();
    }
  }, [notice]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="d-none"
        data-bs-toggle="modal"
        data-bs-target={`#${id}`}
        aria-hidden="true"
      />
      <ModalDialog
        id={id}
        title={title}
        body={notice?.message ?? ""}
        showActionButton={false}
      />
    </>
  );
}
