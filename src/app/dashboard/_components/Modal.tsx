"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible dialog: closes on Escape or backdrop click, keeps Tab focus inside, and returns focus to the opener. */
export function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])");
    (firstField ?? panel)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1}>
        <div className="modal-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="x" /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  action: () => Promise<void>;
};

export function ConfirmDialog({ options, busy, onCancel, onConfirm }: { options: ConfirmOptions; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal title={options.title} onClose={busy ? () => undefined : onCancel}>
      <div className="confirm-body">{options.message}</div>
      <div className="modal-actions">
        <button type="button" className="secondary-action" onClick={onCancel} disabled={busy} data-autofocus>Cancel</button>
        <button type="button" className={options.tone === "danger" ? "danger-action" : "primary-action"} onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : options.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
