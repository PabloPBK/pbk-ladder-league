
"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  presentationId: string;
};

export default function PresentationLogoManager({
  presentationId,
}: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(
    null
  );
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLogo() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/tv-presentation-logo?presentation_id=${encodeURIComponent(
            presentationId
          )}`,
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load logo"
          );
        }

        if (!cancelled) {
          setLogoUrl(result.logo_url ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load logo"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLogo();

    return () => {
      cancelled = true;
    };
  }, [presentationId]);

  async function uploadLogo(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedFile || saving) return;

    setError("");
    setMessage("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Please select a PNG, JPG, or WebP image.");
      return;
    }

    if (
      selectedFile.size === 0 ||
      selectedFile.size > 4 * 1024 * 1024
    ) {
      setError("Logo must be between 1 byte and 4 MB.");
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append(
        "presentation_id",
        presentationId
      );

      const response = await fetch(
        "/api/tv-presentation-logo",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to upload logo"
        );
      }

      setLogoUrl(result.logo_url ?? null);
      setSelectedFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      setMessage("Presentation logo saved successfully!");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload logo"
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeLogo() {
    if (saving || !logoUrl) return;

    if (
      !window.confirm(
        "Remove the logo from this presentation?"
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/tv-presentation-logo?presentation_id=${encodeURIComponent(
          presentationId
        )}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to remove logo"
        );
      }

      setLogoUrl(null);
      setMessage(
        result.warning ||
          "Presentation logo removed successfully!"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove logo"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-zinc-700 bg-zinc-950 p-6">
      <h3 className="text-lg font-bold text-yellow-400">
        Presentation Logo
      </h3>

      <p className="mt-2 text-sm text-zinc-400">
        Upload a custom logo for this presentation.
        PNG images with transparent backgrounds work best.
        Maximum file size: 4 MB.
      </p>

      {loading ? (
        <p className="mt-4 text-zinc-400">
          Loading presentation logo...
        </p>
      ) : (
        <>
          {logoUrl ? (
            <div className="mt-5">
              <p className="mb-3 text-sm font-semibold text-white">
                Current Logo
              </p>

              <div className="flex min-h-40 items-center justify-center rounded-xl border border-zinc-700 bg-black p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt="Current presentation logo"
                  className="max-h-40 max-w-full object-contain"
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">
              No logo uploaded yet.
            </p>
          )}

          <form
            onSubmit={uploadLogo}
            className="mt-5 space-y-4"
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={saving}
              onChange={(event) => {
                setSelectedFile(
                  event.target.files?.[0] ?? null
                );
                setError("");
                setMessage("");
              }}
              className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-3 file:font-semibold file:text-white"
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!selectedFile || saving}
                className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : logoUrl
                    ? "Replace Logo"
                    : "Upload Logo"}
              </button>

              {logoUrl && (
                <button
                  type="button"
                  onClick={() => void removeLogo()}
                  disabled={saving}
                  className="rounded-lg border border-red-700 px-6 py-3 font-bold text-red-400 disabled:opacity-50"
                >
                  Remove Logo
                </button>
              )}
            </div>
          </form>
        </>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="mt-4 text-sm text-green-400"
        >
          {message}
        </p>
      )}
    </section>
  );
}
