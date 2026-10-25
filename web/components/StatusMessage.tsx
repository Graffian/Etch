import type { ReactNode } from "react";

export type StatusTone = "info" | "success" | "warning" | "error";

type StatusMessageProps = {
  tone?: StatusTone;
  title?: string;
  children: ReactNode;
};

export function StatusMessage({
  tone = "info",
  title,
  children,
}: StatusMessageProps) {
  return (
    <div
      className={`status-message status-message--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {title ? <p className="status-message__title">{title}</p> : null}
      <div className="status-message__body">{children}</div>
    </div>
  );
}
