import { useCallback, useRef, useState } from 'react';
import { Upload, X, GripVertical, Loader2, ImageIcon, Link as LinkIcon, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { uploadImage, removeImage, validateImageFile, ACCEPTED_IMAGE_EXT } from '../lib/storage';

export interface UploadedImage {
  url: string;
  path: string;
  /** local object URL for preview while uploading / before save */
  preview?: string;
  uploading?: boolean;
  error?: string;
}

interface Props {
  bucket: 'product-images' | 'category-images' | 'cms-images';
  folder: string;
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  multiple?: boolean;
  label?: string;
  onNotification?: (type: 'success' | 'error', msg: string) => void;
}

export default function ImageUploader({ bucket, folder, images, onChange, multiple = true, label, onNotification }: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const tr = useCallback((ar: string, fr: string) => (isAr ? ar : fr), [isAr]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setGlobalErr(null);
    const arr = Array.from(files);
    if (!multiple && arr.length > 0) {
      // single-image mode: replace
      for (const img of images) {
        if (img.path) await removeImage(bucket, img.path);
      }
      onChange([]);
    }
    const max = multiple ? 10 : 1;
    const toAdd = arr.slice(0, max - (multiple ? images.length : 0));
    if (toAdd.length === 0) {
      const limitMsg = tr('الحد الأقصى للصور', 'Limite d\'images atteinte');
      setGlobalErr(limitMsg);
      if (onNotification) onNotification('error', limitMsg);
      return;
    }

    const placeholders: UploadedImage[] = toAdd.map((f) => ({
      url: '',
      path: "",
      preview: URL.createObjectURL(f),
      uploading: true,
    }));
    let working = multiple ? [...images, ...placeholders] : placeholders;
    onChange(working);

    for (let i = 0; i < toAdd.length; i++) {
      const file = toAdd[i];
      const vErr = validateImageFile(file);
      const idx = working.length - toAdd.length + i;
      if (vErr) {
        working = working.map((im, j) => (j === idx ? { ...im, uploading: false, error: vErr } : im));
        onChange(working);
        if (onNotification) onNotification('error', `${file.name}: ${vErr}`);
        continue;
      }
      const res = await uploadImage(bucket, file, folder);
      if ('error' in res) {
        working = working.map((im, j) => (j === idx ? { ...im, uploading: false, error: res.error } : im));
        if (onNotification) {
          onNotification('error', tr(`فشل رفع الصورة: ${res.error}`, `Image upload failed: ${res.error}`));
        }
      } else {
        working = working.map((im, j) =>
          j === idx ? { ...im, url: res.url, path: res.path, uploading: false, preview: undefined } : im,
        );
        if (onNotification) {
          onNotification('success', tr('تم رفع الصورة بنجاح.', 'Image uploaded successfully.'));
        }
      }
      onChange(working);
    }
  }, [bucket, folder, images, onChange, multiple, tr, onNotification]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeAt = useCallback(async (index: number) => {
    const target = images[index];
    if (target?.path) await removeImage(bucket, target.path);
    onChange(images.filter((_, i) => i !== index));
  }, [bucket, images, onChange]);

  const move = useCallback((from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }, [images, onChange]);

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    const newImg: UploadedImage = { url: customUrl.trim(), path: '' };
    if (!multiple) {
      onChange([newImg]);
    } else {
      onChange([...images, newImg]);
    }
    setCustomUrl('');
    setShowUrlInput(false);
    if (onNotification) onNotification('success', tr('تمت إضافة رابط الصورة', 'Image URL ajoutée'));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {label && <label className="block text-xs font-semibold text-slate-300">{label}</label>}
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 border border-emerald-900/60 bg-emerald-950/40 px-2 py-0.5 rounded-lg transition"
        >
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? tr('إلغاء', 'Annuler') : tr('إضافة عبر رابط URL', 'Ajouter via URL')}
        </button>
      </div>

      {showUrlInput && (
        <form onSubmit={handleAddUrl} className="flex gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://images.unsplash.com/photo-..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            {tr('إضافة', 'Ajouter')}
          </button>
        </form>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
          dragOver ? 'border-emerald-500 bg-emerald-950/30' : 'border-slate-800 bg-slate-950 hover:border-emerald-500 hover:bg-slate-900/80'
        }`}
      >
        <Upload className="mb-2 h-6 w-6 text-emerald-400" />
        <p className="text-xs font-semibold text-slate-200">
          {tr('اسحب وأفلت الصور هنا أو اضغط للتصفح', 'Glissez-déposez les images ici ou cliquez pour parcourir')}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          JPG, PNG, WebP, AVIF · Max 5 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_EXT}
          multiple={multiple}
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {globalErr && <p className="text-xs text-rose-400">{globalErr}</p>}

      {/* Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img, i) => {
            if (img.error && !img.url) {
              return (
                <div key={i} className="relative flex aspect-square items-center justify-center rounded-lg border border-rose-800/80 bg-rose-950/40 p-2 text-center">
                  <span className="text-[10px] leading-tight text-rose-300">{img.error}</span>
                  <button type="button" onClick={() => removeAt(i)} className="absolute top-1 ltr:right-1 rtl:left-1 rounded-full bg-rose-600 p-0.5 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            }
            const displaySrc = img.preview || img.url;
            if (!displaySrc) return null;
            return (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                <img
                  src={displaySrc}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                  }}
                />
                {img.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                  </div>
                )}
                {/* overlay actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-slate-950/0 opacity-0 transition group-hover:bg-slate-950/70 group-hover:opacity-100">
                  {multiple && (
                    <>
                      <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0}
                        className="rounded-md bg-slate-800/90 p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-30" title={tr('يسار', 'Gauche')}>
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1}
                        className="rounded-md bg-slate-800/90 p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-30" title={tr('يمين', 'Droite')}>
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => removeAt(i)}
                    className="rounded-md bg-rose-600 p-1 text-white hover:bg-rose-500" title={tr('حذف', 'Supprimer')}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {i === 0 && multiple && (
                  <span className="absolute bottom-1 ltr:left-1 rtl:right-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {tr('رئيسية', 'Principale')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {images.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ImageIcon className="h-4 w-4 text-slate-500" />
          {tr('لا توجد صورة بعد', 'Aucune image')}
        </div>
      )}
    </div>
  );
}
