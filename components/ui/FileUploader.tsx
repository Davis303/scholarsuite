"use client";

import { useRef, useState } from "react";
import { Button } from "./Button";

export interface FileUploaderProps {
  accept: string;
  maxMB: number;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label?: string;
}

function acceptTokens(accept: string): string[] {
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function fileMatches(file: File, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

export function FileUploader({
  accept,
  maxMB,
  multiple = false,
  onFiles,
  label = "Upload files",
}: FileUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChosen = (files: FileList | File[]) => {
    const tokens = acceptTokens(accept);
    const incoming = Array.from(files);
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (!fileMatches(file, tokens)) {
        rejected.push(`"${file.name}" is not a supported file type.`);
        continue;
      }
      if (file.size > maxMB * 1024 * 1024) {
        rejected.push(`"${file.name}" is too large (limit ${maxMB} MB).`);
        continue;
      }
      accepted.push(file);
    }

    setError(rejected.length > 0 ? rejected.join(" ") : null);
    if (accepted.length === 0) return;
    const next = multiple ? [...selected, ...accepted] : accepted;
    setSelected(next);
    onFiles(next);
  };

  const removeFile = (index: number) => {
    const next = selected.filter((_, i) => i !== index);
    setSelected(next);
    onFiles(next);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleChosen(event.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 ${
          dragging ? "border-accent-600 bg-accent-50" : "border-slate-300 bg-slate-50 hover:border-slate-400"
        }`}
      >
        <svg
          className="h-8 w-8 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="mt-2 text-sm font-medium text-slate-700">
          {dragging ? "Drop files here" : "Drag and drop files here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Accepted: {accept} · Max {maxMB} MB{multiple ? " per file" : ""}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            if (event.target.files) handleChosen(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {selected.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {selected.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span className="truncate text-slate-700">
                {file.name}{" "}
                <span className="text-xs text-slate-500">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </span>
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${file.name}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
