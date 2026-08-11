import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, X, Star, ArrowLeft, ArrowRight, Trash2, 
  Plus, Link as LinkIcon, Image as ImageIcon, Eye
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { uploadImage, removeImage, validateImageFile, ACCEPTED_IMAGE_EXT, pathFromUrl } from '../lib/storage';

interface ProductImageGalleryEditorProps {
  images: string[];
  onChange: (images: string[]) => void;
  onNotification?: (type: 'success' | 'error', msg: string) => void;
}

export interface ImageItem {
  id: string;
  url: string;
  path?: string;
  uploading?: boolean;
  error?: string;
}

export default function ProductImageGalleryEditor({
  images,
  onChange,
  onNotification
}: ProductImageGalleryEditorProps) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const tr = useCallback((ar: string, fr: string) => (isAr ? ar : fr), [isAr]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // Helper to sync parent state
  const notifyChange = (newImages: string[]) => {
    onChange(newImages);
  };

  // Upload local files
  const handleAddFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const remainingSlots = 15 - images.length;
    if (remainingSlots <= 0) {
      const msg = tr('تم الوصول للحد الأقصى من الصور (15 صورة)', 'Limite de 15 images atteinte');
      if (onNotification) onNotification('error', msg);
      return;
    }

    const filesToUpload = fileList.slice(0, remainingSlots);
    const updatedImages = [...images];

    for (const file of filesToUpload) {
      const vErr = validateImageFile(file);
      if (vErr) {
        if (onNotification) onNotification('error', `${file.name}: ${vErr}`);
        continue;
      }

      const res = await uploadImage('product-images', file, 'products');
      if ('error' in res) {
        if (onNotification) {
          onNotification('error', tr(`فشل رفع الصورة ${file.name}: ${res.error}`, `Échec du téléchargement ${file.name}: ${res.error}`));
        }
      } else {
        updatedImages.push(res.url);
        if (onNotification) {
          onNotification('success', tr('تم رفع الصورة بنجاح', 'Image téléchargée avec succès'));
        }
      }
    }

    notifyChange(updatedImages);
  };

  const dragCounterRef = useRef(0);

  // Drag and Drop files onto dropzone
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragOver(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  // Add URL image directly
  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    const trimmed = urlInput.trim();
    if (images.length >= 15) {
      if (onNotification) onNotification('error', tr('الحد الأقصى 15 صورة', 'Maximum 15 images'));
      return;
    }

    notifyChange([...images, trimmed]);
    setUrlInput('');
    setShowUrlForm(false);
    if (onNotification) onNotification('success', tr('تمت إضافة رابط الصورة', 'URL d\'image ajoutée'));
  };

  // Remove individual image
  const handleRemoveImage = async (index: number) => {
    const targetUrl = images[index];
    const path = pathFromUrl('product-images', targetUrl);
    if (path) {
      await removeImage('product-images', path);
    }

    const newArr = images.filter((_, i) => i !== index);
    notifyChange(newArr);
    if (onNotification) onNotification('success', tr('تم حذف الصورة', 'Image supprimée'));
  };

  // Set as Main Image (Index 0)
  const handleSetMainImage = (index: number) => {
    if (index === 0) return;
    const newArr = [...images];
    const [selected] = newArr.splice(index, 1);
    newArr.unshift(selected);
    notifyChange(newArr);
    if (onNotification) onNotification('success', tr('تم تعيين الصورة كصورة رئيسية', 'Définie comme image principale'));
  };

  // Move position left/right
  const handleMoveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const newArr = [...images];
    const [item] = newArr.splice(from, 1);
    newArr.splice(to, 0, item);
    notifyChange(newArr);
  };

  // Replace image at index
  const triggerReplace = (index: number) => {
    setReplaceIndex(index);
    if (replaceInputRef.current) {
      replaceInputRef.current.click();
    }
  };

  const handleFileReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (replaceIndex === null || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const vErr = validateImageFile(file);
    if (vErr) {
      if (onNotification) onNotification('error', vErr);
      return;
    }

    const res = await uploadImage('product-images', file, 'products');
    if ('error' in res) {
      if (onNotification) onNotification('error', res.error);
    } else {
      const newArr = [...images];
      newArr[replaceIndex] = res.url;
      notifyChange(newArr);
      if (onNotification) onNotification('success', tr('تم استبدال الصورة بنجاح', 'Image remplacée'));
    }
    setReplaceIndex(null);
    e.target.value = '';
  };

  // HTML5 Drag & drop reorder between gallery cards
  const handleCardDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleCardDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
  };

  const handleCardDrop = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    handleMoveImage(draggedIdx, targetIdx);
    setDraggedIdx(null);
  };

  return (
    <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            {tr('معرض صور المنتج (سلسلة صور متعددة)', 'Galerie Photos du Produit')}
          </label>
          <p className="text-[11px] text-slate-400">
            {tr('الصورة الأولى تكون هي الصورة الرئيسية للمنتج. يمكنك سحب الصور لإعادة الترتيب أو تحديد الصورة الرئيسية.', 'La première image est la photo principale. Glissez pour réordonner.')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowUrlForm(!showUrlForm)}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 border border-indigo-900/60 bg-indigo-950/40 px-2.5 py-1 rounded-lg transition"
        >
          <LinkIcon className="w-3.5 h-3.5" />
          {showUrlForm ? tr('إخفاء إضافة رابط', 'Masquer URL') : tr('إضافة رابط صورة', 'Ajouter via URL')}
        </button>
      </div>

      {/* URL Input Form */}
      {showUrlForm && (
        <form onSubmit={handleAddUrl} className="flex gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://images.unsplash.com/photo-..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            {tr('إضافة', 'Ajouter')}
          </button>
        </form>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          dragOver 
            ? 'border-emerald-500 bg-emerald-950/30' 
            : 'border-slate-800 bg-slate-900/60 hover:border-emerald-600/70 hover:bg-slate-900'
        }`}
      >
        <Upload className="w-6 h-6 mx-auto mb-2 text-emerald-400 opacity-80" />
        <p className="text-xs font-semibold text-slate-200">
          {tr('اسحب وأسقط صور المنتج هنا أو اضغط للتصفح', 'Glissez-déposez des images ici ou cliquez pour parcourir')}
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          {tr('يدعم اختيار صور متعددة (JPG, PNG, WebP) - حتى 15 صورة', 'Sélection multiple autorisée (JPG, PNG, WebP) - jusqu\'à 15 photos')}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_EXT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleAddFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_EXT}
          className="hidden"
          onChange={handleFileReplace}
        />
      </div>

      {/* Image Gallery Grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
          {images.map((imgUrl, idx) => {
            const isMain = idx === 0;
            return (
              <div
                key={`${imgUrl}-${idx}`}
                draggable
                onDragStart={() => handleCardDragStart(idx)}
                onDragOver={(e) => handleCardDragOver(e, idx)}
                onDrop={() => handleCardDrop(idx)}
                className={`group relative aspect-square rounded-xl overflow-hidden bg-slate-900 border transition-all ${
                  isMain 
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md' 
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`Product Image ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Main Badge */}
                {isMain && (
                  <span className="absolute top-1.5 ltr:left-1.5 rtl:right-1.5 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow flex items-center gap-1 z-10">
                    <Star className="w-3 h-3 fill-current text-amber-300" />
                    {tr('الرئيسية', 'Principale')}
                  </span>
                )}

                {/* Hover Action Overlay */}
                <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-2">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(imgUrl)}
                      className="p-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                      title={tr('معاينة', 'Aperçu')}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="p-1 rounded bg-rose-600/90 hover:bg-rose-600 text-white"
                      title={tr('حذف', 'Supprimer')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {!isMain && (
                      <button
                        type="button"
                        onClick={() => handleSetMainImage(idx)}
                        className="w-full py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center justify-center gap-1 shadow"
                      >
                        <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                        {tr('تعيين كرئيسية', 'Définir Principale')}
                      </button>
                    )}

                    <div className="flex items-center justify-between gap-1 text-[10px]">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveImage(idx, idx - 1)}
                        className="p-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30"
                        title={tr('نقل للأمام', 'Avancer')}
                      >
                        {isAr ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => triggerReplace(idx)}
                        className="px-1.5 py-0.5 rounded bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 font-semibold"
                        title={tr('استبدال', 'Remplacer')}
                      >
                        {tr('استبدال', 'Remplacer')}
                      </button>

                      <button
                        type="button"
                        disabled={idx === images.length - 1}
                        onClick={() => handleMoveImage(idx, idx + 1)}
                        className="p-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30"
                        title={tr('نقل للرئيسية', 'Reculer')}
                      >
                        {isAr ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-4 text-center text-xs text-slate-500">
          {tr('لم يتم إضافة أي صورة لهذا المنتج بعد', 'Aucune image ajoutée à ce produit')}
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-2 overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-4 rtl:left-4 ltr:right-4 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewUrl} alt="Preview" className="w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
