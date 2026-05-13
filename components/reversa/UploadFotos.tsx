'use client';

import { useCallback, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface UploadFotosProps {
  fotos: File[];
  onChange: (fotos: File[]) => void;
  maxFotos?: number;
  error?: string;
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
};

export function UploadFotos({
  fotos,
  onChange,
  maxFotos = 5,
  error,
}: UploadFotosProps) {
  const [comprimindo, setComprimindo] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const novasFiles = Array.from(files).slice(0, maxFotos - fotos.length);
      if (novasFiles.length === 0) return;

      setComprimindo(true);
      try {
        const comprimidas = await Promise.all(
          novasFiles.map((f) => imageCompression(f, COMPRESSION_OPTIONS))
        );

        const novosPreviews = await Promise.all(
          comprimidas.map(
            (f) =>
              new Promise<string>((res) => {
                const reader = new FileReader();
                reader.onload = (e) => res(e.target?.result as string);
                reader.readAsDataURL(f);
              })
          )
        );

        onChange([...fotos, ...comprimidas]);
        setPreviews((prev) => [...prev, ...novosPreviews]);
      } finally {
        setComprimindo(false);
      }
    },
    [fotos, maxFotos, onChange]
  );

  const removerFoto = (index: number) => {
    const novasFotos = fotos.filter((_, i) => i !== index);
    const novosPreviews = previews.filter((_, i) => i !== index);
    onChange(novasFotos);
    setPreviews(novosPreviews);
  };

  const podeAdicionar = fotos.length < maxFotos && !comprimindo;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-mocha-700">
          Fotos do produto
          <span className="ml-1 text-flavia-500" aria-hidden="true">*</span>
        </span>
        <span className="text-xs text-mocha-500">
          {fotos.length}/{maxFotos} fotos
        </span>
      </div>

      {/* Grid de previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-flavia overflow-hidden border border-flavia-200 group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Foto ${i + 1} do produto`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removerFoto(i)}
                aria-label={`Remover foto ${i + 1}`}
                className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger-100"
              >
                <X className="h-3.5 w-3.5 text-danger-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Área de drop / upload */}
      {podeAdicionar && (
        <label
          htmlFor="upload-fotos"
          className={clsx(
            'flex flex-col items-center justify-center gap-2',
            'border-2 border-dashed rounded-flavia-lg px-4 py-6',
            'cursor-pointer transition-all duration-200',
            error
              ? 'border-danger-500 bg-danger-100/40'
              : 'border-flavia-300 bg-cream-50 hover:border-flavia-500 hover:bg-flavia-50'
          )}
        >
          {comprimindo ? (
            <>
              <Loader2 className="h-6 w-6 text-flavia-400 animate-spin" />
              <span className="text-sm text-mocha-500">Otimizando imagens...</span>
            </>
          ) : (
            <>
              <div className="p-2 bg-flavia-100 rounded-full">
                <Upload className="h-5 w-5 text-flavia-500" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium text-flavia-600">
                  Toque para adicionar fotos
                </span>
                <p className="text-xs text-mocha-500 mt-0.5">
                  PNG, JPG ou WEBP • Máx. {maxFotos} fotos • As imagens serão otimizadas automaticamente
                </p>
              </div>
            </>
          )}

          <input
            id="upload-fotos"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={!podeAdicionar}
            aria-label="Selecionar fotos do produto"
          />
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger-500">⚠ {error}</p>
      )}

      <p className="text-xs text-mocha-500 flex items-center gap-1">
        <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Fotografe todos os lados do produto e, se houver, a embalagem também. Isso agiliza muito o processo! 💛
      </p>
    </div>
  );
}
