"use client";

import { useEffect, useRef } from "react";
import { ModalDialog } from "@/app/components/ModalDialog";

type NoticeModalProps = {
  id: string;
  title?: string;
  notice: { message: string } | null;
};

/**
The ModalDialog uses a bootstrap component and needs a button click to become visible. 
This components works as a wrapper around the ModalDialog to trigger it by programatically "clicking" an invisible button. 
This way we can reuse the ModalDialog to display error messages: it's shown whenever a new notice / error message is set.
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
