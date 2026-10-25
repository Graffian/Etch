"use client";

import { useId, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

import { formatBytes } from "@/lib/format";

type SelectedFile = {
  name: string;
  size: number;
};

type DropzoneProps = {
  accept?: string;
  disabled?: boolean;
  onFileSelect?: (file: File) => void;
};

export function Dropzone({
  accept,
  disabled = false,
  onFileSelect,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const titleId = useId();
  const hintId = useId();
  const noteId = useId();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [dragging, setDragging] = useState(false);

  function acceptFile(file: File | undefined) {
    if (!file || disabled) {
      return;
    }
    setSelectedFile({ name: file.name, size: file.size });
    onFileSelect?.(file);
  }

  function openPicker() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!disabled) {
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  return (
    <section
      className={`dropzone${dragging ? " is-dragging" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={`${hintId} ${noteId}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="dropzone__copy">
        <h3 className="dropzone__title" id={titleId}>
          Drop a file here
        </h3>
        <p className="dropzone__hint" id={hintId}>
          Or choose one from your device.
        </p>
      </div>
      <div className="dropzone__actions">
        <button
          className="button button--primary"
          type="button"
          onClick={openPicker}
          disabled={disabled}
        >
          {selectedFile ? "Choose a different file" : "Choose a file"}
        </button>
        <span className="dropzone__input-note">Any file type</span>
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={accept}
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
      />
      <div
        className="dropzone__status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {selectedFile ? (
          <>
            <span className="dropzone__status-label">Selected file</span>
            <span className="dropzone__file">{selectedFile.name}</span>
            <span className="dropzone__size">
              {formatBytes(selectedFile.size)}
            </span>
          </>
        ) : (
          <span className="dropzone__status-label">No file selected</span>
        )}
      </div>
      <p className="dropzone__note" id={noteId}>
        The file stays on your device. Etch only uses its SHA-256 fingerprint.
      </p>
    </section>
  );
}
