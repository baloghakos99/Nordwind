import { useCallback, useRef, useState } from 'react';

export default function UploadZone({ onUploaded, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastSummary, setLastSummary] = useState(null);
  const [error, setError] = useState(null);

  const uploadFiles = useCallback(async (fileList) => {
    const files = [...fileList].filter((f) =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (files.length === 0) {
      setError('Nincs PDF a kiválasztott fájlok között.');
      return;
    }

    setError(null);
    setUploading(true);
    setLastSummary(null);

    try {
      const body = new FormData();
      for (const file of files) {
        body.append('files', file);
      }

      const res = await fetch('/api/invoices/upload', {
        method: 'POST',
        body,
      });
      const data = await res.json();
      if (!res.ok && !data.results) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setLastSummary(data.summary);
      onUploaded?.(data);
    } catch (e) {
      setError(e.message || 'Feltöltés sikertelen');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onUploaded]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    uploadFiles(e.dataTransfer.files);
  };

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--nw-ink)]/60">
        Számlák feltöltése
      </h2>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={[
          'mt-3 cursor-pointer rounded-sm border border-dashed px-6 py-12 text-center transition-colors',
          dragging
            ? 'border-[var(--nw-sky)] bg-[var(--nw-sky)]/10'
            : 'border-[var(--nw-ink)]/25 bg-white/40 hover:border-[var(--nw-sky)]/60',
          (disabled || uploading) ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <p className="text-lg font-medium text-[var(--nw-ink)]">
          {uploading ? 'Feltöltés folyamatban…' : 'Húzd ide a PDF-eket, vagy kattints'}
        </p>
        <p className="mt-2 text-sm text-[var(--nw-ink)]/60">
          Több fájl egyszerre (akár 100). Nem PDF / hibás fájl nem állítja le a többit.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files || [])}
        />
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-800">{error}</p>
      )}
      {lastSummary && (
        <p className="mt-3 text-sm text-[var(--nw-ink)]/80">
          Új: {lastSummary.accepted} · duplikátum: {lastSummary.duplicates} · hiba:{' '}
          {lastSummary.failed} · összesen: {lastSummary.total}
        </p>
      )}
    </section>
  );
}
