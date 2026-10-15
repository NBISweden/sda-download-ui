"use client";

import { useEffect } from "react";
import { ModalDialog, useModalTrigger } from "@/app/components/ModalDialog";

type NoticeModalProps = {
  title?: string;
  notice: { message: string } | null;
};

/**
 * ModalDialog is a Bootstrap modal that requires a button click to open.
 * This component wraps ModalDialog and triggers it by programmatically clicking a hidden button
 * whenever a new notice/error message is set.
 */

export function NoticeModal({ title = "Notice", notice }: NoticeModalProps) {
  const [modalTrigger, modalId] = useModalTrigger();

  // Open the modal whenever a new notice is set.
  useEffect(() => {
    if (notice) {
      modalTrigger();
    }
  }, [notice, modalTrigger]);

  return (
    <>
      <ModalDialog id={modalId} title={title} body={notice?.message ?? ""} />
    </>
  );
}
