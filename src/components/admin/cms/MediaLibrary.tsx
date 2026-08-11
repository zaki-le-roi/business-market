import { useState, useEffect, useRef } from 'react';
import { 
  FolderPlus, Folder, FolderOpen, Upload, Search, Trash2, Edit3, 
  Copy, FileText, Video, X, Check, Eye, Plus, Play, RefreshCw
} from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useToast } from '../../../contexts/ToastContext';
import ConfirmDeleteModal from '../../ConfirmDeleteModal';
import { CMSMediaItem, CMSFolder } from '../../../types';
import { 
  fetchMedia, 
  saveMediaItem, 
  deleteMediaItem, 
  toggleMediaPublishStatus 
} from '../../../lib/cms';
import { uploadImage, removeImage, validateImageFile } from '../../../lib/storage';

const INITIAL_FOLDERS: CMSFolder[] = [
  { id: 'f-videos', name: 'الفيديوهات والعروض (Videos)', path: '/videos', item_count: 3 },
  { id: 'f-1', name: 'Banners & Headers', path: '/banners', item_count: 3 },
  { id: 'f-2', name: 'Legal Policies', path: '/policies', item_count: 4 },
  { id: 'f-3', name: 'Product Guides', path: '/guides', item_count: 2 },
  { id: 'f-4', name: 'Logos & Branding', path: '/branding', item_count: 5 },
];

interface MediaLibraryProps {
  onSelectMedia?: (mediaUrl: string) => void;
  isModalPicker?: boolean;
  onClosePicker?: () => void;
}

export default function MediaLibrary({ onSelectMedia, isModalPicker, onClosePicker }: MediaLibraryProps) {
  const { lang, dir } = useLanguage();
  const { showToast } = useToast();

  const [folders, setFolders] = useState<CMSFolder[]>(INITIAL_FOLDERS);
  const [mediaItems, setMediaItems] = useState<CMSMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderPath, setCurrentFolderPath] = useState<string>('/');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'pdf' | 'video'>('all');
  
  // Selection and Modals
  const [selectedItem, setSelectedItem] = useState<CMSMediaItem | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Video / Media Add & Edit Modal State
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [showEditMediaModal, setShowEditMediaModal] = useState(false);
  const [editingMediaItem, setEditingMediaItem] = useState<CMSMediaItem | null>(null);

  // Video / Media Form State
  const [mediaFormName, setMediaFormName] = useState('');
  const [mediaFormTitleAr, setMediaFormTitleAr] = useState('');
  const [mediaFormTitleFr, setMediaFormTitleFr] = useState('');
  const [mediaFormTitleEn, setMediaFormTitleEn] = useState('');
  const [mediaFormDescAr, setMediaFormDescAr] = useState('');
  const [mediaFormDescFr, setMediaFormDescFr] = useState('');
  const [mediaFormUrl, setMediaFormUrl] = useState('');
  const [mediaFormFolder, setMediaFormFolder] = useState('/videos');
  const [mediaFormType, setMediaFormType] = useState<'video' | 'image' | 'pdf'>('video');
  const [mediaFormStatus, setMediaFormStatus] = useState<'published' | 'draft'>('published');
  const [mediaFormSizeBytes, setMediaFormSizeBytes] = useState(15000000);
  const [mediaFormMimeType, setMediaFormMimeType] = useState('video/mp4');

  // Video Preview Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewMediaItem, setPreviewMediaItem] = useState<CMSMediaItem | null>(null);

  // Delete Media Modal State
  const [deleteTargetMedia, setDeleteTargetMedia] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingMedia, setIsDeletingMedia] = useState(false);
  const [deleteMediaError, setDeleteMediaError] = useState<string | null>(null);

  // Delete Folder Modal State
  const [deleteTargetFolder, setDeleteTargetFolder] = useState<CMSFolder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [deleteFolderError, setDeleteFolderError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Load Media from Storage on Mount
  useEffect(() => {
    loadMediaData();
  }, []);

  const loadMediaData = async () => {
    setLoading(true);
    try {
      const items = await fetchMedia();
      setMediaItems(items);
    } catch (e) {
      console.error('[MediaLibrary] Error loading media data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Folder Navigation helpers
  const handleOpenFolder = (path: string) => {
    setCurrentFolderPath(path);
    setSelectedItem(null);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const cleanName = newFolderName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const newPath = currentFolderPath === '/' ? `/${cleanName}` : `${currentFolderPath}/${cleanName}`;
    
    if (folders.some(f => f.path === newPath)) {
      showToast(lang === 'ar' ? 'المجلد موجود بالفعل' : 'Ce dossier existe déjà', 'error');
      return;
    }

    const newFolder: CMSFolder = {
      id: `f-${Date.now()}`,
      name: newFolderName,
      path: newPath,
      item_count: 0,
    };

    setFolders([...folders, newFolder]);
    setShowNewFolderModal(false);
    setNewFolderName('');
    showToast(lang === 'ar' ? 'تم إنشاء المجلد بنجاح' : 'Dossier créé avec succès', 'success');
  };

  // Open Add Video / Media Modal
  const handleOpenAddVideo = () => {
    setEditingMediaItem(null);
    setMediaFormName(`video_${Date.now()}.mp4`);
    setMediaFormTitleAr('');
    setMediaFormTitleFr('');
    setMediaFormTitleEn('');
    setMediaFormDescAr('');
    setMediaFormDescFr('');
    setMediaFormUrl('');
    setMediaFormFolder(currentFolderPath === '/' ? '/videos' : currentFolderPath);
    setMediaFormType('video');
    setMediaFormStatus('published');
    setMediaFormSizeBytes(15000000);
    setMediaFormMimeType('video/mp4');
    setShowAddVideoModal(true);
  };

  // Real File Processing Handler
  const handleProcessFileSelect = async (file: File) => {
    const vErr = validateImageFile(file);
    if (vErr) {
      showToast(vErr, 'error');
      return;
    }

    let detectedType: 'video' | 'image' | 'pdf' = 'image';
    if (file.type.includes('pdf') || file.name.endsWith('.pdf')) detectedType = 'pdf';
    else if (file.type.includes('video') || file.name.match(/\.(mp4|webm|mov|avi)$/i)) detectedType = 'video';

    setUploading(true);
    try {
      const targetFolder = mediaFormFolder || (currentFolderPath === '/' ? '/videos' : currentFolderPath);
      const res = await uploadImage('cms-images', file, targetFolder);
      
      let finalUrl = '';
      if ('url' in res) {
        finalUrl = res.url;
      } else {
        // Data URL fallback
        finalUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      setMediaFormUrl(finalUrl);
      setMediaFormType(detectedType);
      setMediaFormName(file.name);
      setMediaFormSizeBytes(file.size || 500000);
      setMediaFormMimeType(file.type || (detectedType === 'video' ? 'video/mp4' : 'image/jpeg'));
      if (!mediaFormTitleAr) setMediaFormTitleAr(file.name.split('.')[0]);

      showToast(
        lang === 'ar' ? 'تم رفع المعاينة الحية بنجاح' : 'Fichier téléversé avec succès',
        'success'
      );
    } catch (e) {
      console.error('[MediaLibrary] Upload file error:', e);
      showToast(lang === 'ar' ? 'حدث خطأ أثناء رفع الملف' : 'Erreur de téléversement', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Save Video / Media (Create or Update)
  const handleSaveVideoMedia = async () => {
    if (!mediaFormUrl.trim()) {
      showToast(lang === 'ar' ? 'يرجى اختيار ملف من حاسوبك أو إدخال رابط مفعل' : 'Veuillez téléverser un fichier', 'error');
      return;
    }

    const isEditing = !!editingMediaItem;
    const mediaId = isEditing ? editingMediaItem.id : `m-${Date.now()}`;
    const name = mediaFormName || mediaFormTitleAr || mediaFormTitleFr || `media_${Date.now()}`;

    const newItem: CMSMediaItem = {
      id: mediaId,
      name,
      title_ar: mediaFormTitleAr || name,
      title_fr: mediaFormTitleFr || name,
      title_en: mediaFormTitleEn || name,
      description_ar: mediaFormDescAr,
      description_fr: mediaFormDescFr,
      folder: mediaFormFolder || '/videos',
      file_type: mediaFormType,
      url: mediaFormUrl.trim(),
      size_bytes: mediaFormSizeBytes,
      mime_type: mediaFormMimeType,
      dimensions: mediaFormType === 'video' ? '1080p' : '1920x1080',
      status: mediaFormStatus,
      created_at: editingMediaItem ? editingMediaItem.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const res = await saveMediaItem(newItem);
      if (res.success) {
        const freshItems = await fetchMedia();
        setMediaItems(freshItems);
        if (selectedItem?.id === mediaId) {
          setSelectedItem(newItem);
        }
        setShowAddVideoModal(false);
        setShowEditMediaModal(false);
        setEditingMediaItem(null);

        showToast(
          isEditing 
            ? (lang === 'ar' ? 'تم حفظ تعديلات وسائط الفيديو بنجاح' : 'Vidéo mise à jour avec succès')
            : (lang === 'ar' ? 'تم إضافة ونشر وسائط الفيديو بنجاح في المكتبة' : 'Vidéo ajoutée avec succès'),
          'success'
        );
      } else {
        showToast(res.error || (lang === 'ar' ? 'حدث خطأ في حفظ الفيديو' : 'Erreur lors de l\'enregistrement'), 'error');
      }
    } catch (e) {
      console.error('[MediaLibrary] Save video error:', e);
      showToast(lang === 'ar' ? 'حدث خطأ في حفظ الفيديو' : 'Erreur lors de l\'enregistrement', 'error');
    }
  };

  // Open Edit Media/Video Modal
  const handleOpenEditMedia = (item: CMSMediaItem) => {
    setEditingMediaItem(item);
    setMediaFormName(item.name);
    setMediaFormTitleAr(item.title_ar || item.name);
    setMediaFormTitleFr(item.title_fr || item.name);
    setMediaFormTitleEn(item.title_en || item.name);
    setMediaFormDescAr(item.description_ar || '');
    setMediaFormDescFr(item.description_fr || '');
    setMediaFormUrl(item.url);
    setMediaFormFolder(item.folder || '/videos');
    setMediaFormType(item.file_type === 'document' ? 'pdf' : item.file_type);
    setMediaFormStatus(item.status || 'published');
    setMediaFormSizeBytes(item.size_bytes || 1000000);
    setMediaFormMimeType(item.mime_type || 'video/mp4');
    setShowEditMediaModal(true);
  };

  // Toggle Video / Media Status (Publish / Unpublish)
  const handleTogglePublishMedia = async (item: CMSMediaItem) => {
    try {
      const { success, nextStatus } = await toggleMediaPublishStatus(item.id, item.status || 'published');
      if (success) {
        const freshItems = await fetchMedia();
        setMediaItems(freshItems);
        if (selectedItem?.id === item.id) {
          setSelectedItem({ ...selectedItem, status: nextStatus });
        }

        showToast(
          nextStatus === 'published'
            ? (lang === 'ar' ? 'تم نشر الفيديو على الصفحة الرئيسية بنجاح' : 'Vidéo publiée avec succès')
            : (lang === 'ar' ? 'تم سحب الفيديو إلى المسودات' : 'Vidéo désactivée'),
          'success'
        );
      }
    } catch (e) {
      console.error('[MediaLibrary] Toggle publish error:', e);
    }
  };

  // Delete Video / Media Modal Trigger
  const handleDeleteMedia = (id: string, name: string) => {
    setDeleteMediaError(null);
    setDeleteTargetMedia({ id, name });
  };

  const handleConfirmDeleteMedia = async () => {
    if (!deleteTargetMedia) return;
    setIsDeletingMedia(true);
    setDeleteMediaError(null);
    try {
      const targetItem = mediaItems.find(m => m.id === deleteTargetMedia.id);
      if (targetItem?.url && targetItem.url.includes('cms-images')) {
        const pathPart = targetItem.url.split('/cms-images/').pop() || '';
        if (pathPart) {
          await removeImage('cms-images', pathPart);
        }
      }

      const res = await deleteMediaItem(deleteTargetMedia.id);
      if (res.success) {
        const freshItems = await fetchMedia();
        setMediaItems(freshItems);
        if (selectedItem?.id === deleteTargetMedia.id) setSelectedItem(null);
        showToast(lang === 'ar' ? 'تم حذف الملف بنجاح' : 'Fichier supprimé avec succès', 'success');
        setDeleteTargetMedia(null);
      } else {
        setDeleteMediaError(res.error || (lang === 'ar' ? 'فشل حذف الملف' : 'Erreur de suppression'));
        showToast(res.error || (lang === 'ar' ? 'فشل حذف الملف' : 'Erreur de suppression'), 'error');
      }
    } catch (e: unknown) {
      console.error('[MediaLibrary] Delete media error:', e);
      const msg = (e as Error)?.message || (lang === 'ar' ? 'فشل حذف الملف' : 'Erreur de suppression');
      setDeleteMediaError(msg);
      showToast(msg, 'error');
    } finally {
      setIsDeletingMedia(false);
    }
  };

  // Delete Folder Handlers
  const handleDeleteFolder = (folder: CMSFolder) => {
    setDeleteFolderError(null);
    setDeleteTargetFolder(folder);
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deleteTargetFolder) return;
    setIsDeletingFolder(true);
    setDeleteFolderError(null);
    try {
      setFolders(prev => prev.filter(f => f.id !== deleteTargetFolder.id && f.path !== deleteTargetFolder.path));
      showToast(lang === 'ar' ? 'تم حذف المجلد بنجاح' : 'Dossier supprimé avec succès', 'success');
      setDeleteTargetFolder(null);
    } catch (e: unknown) {
      console.error('[MediaLibrary] Delete folder error:', e);
      const msg = (e as Error)?.message || (lang === 'ar' ? 'فشل حذف المجلد' : 'Erreur de suppression');
      setDeleteFolderError(msg);
      showToast(msg, 'error');
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // Preview Video Modal
  const handleOpenPreview = (item: CMSMediaItem) => {
    setPreviewMediaItem(item);
    setShowPreviewModal(true);
  };

  // Top Bar File Upload Handling
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const vErr = validateImageFile(file);
    if (vErr) {
      showToast(vErr, 'error');
      return;
    }

    setUploading(true);
    let file_type: 'image' | 'pdf' | 'video' | 'document' = 'image';
    if (file.type.includes('pdf')) file_type = 'pdf';
    else if (file.type.includes('video')) file_type = 'video';

    try {
      const targetFolder = currentFolderPath === '/' && file_type === 'video' ? '/videos' : currentFolderPath;
      const res = await uploadImage('cms-images', file, targetFolder);
      
      let finalUrl = '';
      if ('url' in res) {
        finalUrl = res.url;
      } else {
        finalUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const newMedia: CMSMediaItem = {
        id: `m-${Date.now()}`,
        name: file.name,
        title_ar: file.name.split('.')[0],
        title_fr: file.name.split('.')[0],
        title_en: file.name.split('.')[0],
        folder: targetFolder,
        file_type,
        url: finalUrl,
        size_bytes: file.size || 500000,
        mime_type: file.type || (file_type === 'video' ? 'video/mp4' : 'application/octet-stream'),
        dimensions: file_type === 'image' ? '1200x800' : file_type === 'video' ? '1080p' : undefined,
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updatedList = await saveMediaToStorage(newMedia, mediaItems);
      setMediaItems(updatedList);
      setSelectedItem(newMedia);
      showToast(
        lang === 'ar' ? 'تم رفع ونشر ملف الوسائط بنجاح' : 'Fichier téléchargé et publié avec succès',
        'success'
      );
    } catch (e) {
      console.error('[MediaLibrary] File upload error:', e);
      showToast(lang === 'ar' ? 'فشل رفع الملف' : 'Erreur de téléversement', 'error');
    } finally {
      setUploading(false);
    }
  };

  const copyUrlToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast(lang === 'ar' ? 'تم نسخ رابط الفيديو / الملف المباشر' : 'Lien copié dans le presse-papier', 'success');
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filter items in current folder
  const currentFolders = folders.filter(f => {
    if (currentFolderPath === '/') {
      return f.path.split('/').length === 2;
    }
    return f.path.startsWith(currentFolderPath + '/') && f.path.replace(currentFolderPath + '/', '').split('/').length === 1;
  });

  const filteredMedia = mediaItems.filter(item => {
    const matchesFolder = searchQuery ? true : (item.folder === currentFolderPath || (currentFolderPath === '/' && !item.folder));
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.title_ar || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.title_fr || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.file_type === filterType;
    return matchesFolder && matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6" dir={dir}>
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-sm">
        {/* Search & Type filter */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px] flex-1 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 focus-within:border-emerald-500">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث في الفيديوهات والوسائط...' : 'Rechercher des vidéos et médias...'}
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'image' | 'pdf' | 'video')}
            className="bg-slate-900 text-sm text-slate-200 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{lang === 'ar' ? 'كل أنواع الوسائط' : 'Tous les types'}</option>
            <option value="video">{lang === 'ar' ? '🎬 الفيديوهات (Videos)' : 'Vidéos'}</option>
            <option value="image">{lang === 'ar' ? '📷 الصور (Images)' : 'Images'}</option>
            <option value="pdf">{lang === 'ar' ? '📄 مستندات PDF' : 'PDF'}</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Video Button */}
          <button
            onClick={handleOpenAddVideo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-rose-950/40 hover:bg-rose-500 transition"
          >
            <Plus className="w-4 h-4" />
            <Video className="w-4 h-4" />
            {lang === 'ar' ? 'إضافة فيديو جديد' : 'Ajouter vidéo'}
          </button>

          {/* New Folder Button */}
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            <FolderPlus className="w-4 h-4 text-indigo-400" />
            {lang === 'ar' ? 'مجلد جديد' : 'Nouveau dossier'}
          </button>

          {/* Direct Upload Button */}
          <label className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 transition cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" />
            {uploading ? (lang === 'ar' ? 'جاري الرفع...' : 'Téléchargement...') : (lang === 'ar' ? 'رفع ملف من الحاسوب' : 'Téléverser')}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {isModalPicker && onClosePicker && (
            <button onClick={onClosePicker} className="p-2 text-slate-400 hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Path Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800">
        <button
          onClick={() => handleOpenFolder('/')}
          className="font-bold hover:text-emerald-400 transition-colors flex items-center gap-1 text-slate-200"
        >
          <Folder className="w-4 h-4 text-emerald-400" />
          {lang === 'ar' ? 'مكتبة الوسائط (/)' : 'Médiathèque (/)'}
        </button>
        {currentFolderPath !== '/' && currentFolderPath.split('/').filter(Boolean).map((part, idx, arr) => {
          const subPath = '/' + arr.slice(0, idx + 1).join('/');
          return (
            <span key={subPath} className="flex items-center gap-1">
              <span>/</span>
              <button
                onClick={() => handleOpenFolder(subPath)}
                className="font-semibold text-slate-200 hover:text-emerald-400"
              >
                {part}
              </button>
            </span>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Main Grid View */}
        <div className="md:col-span-3 space-y-6">
          {/* Sub Folders */}
          {currentFolders.length > 0 && !searchQuery && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentFolders.map(folder => (
                <div
                  key={folder.id}
                  onClick={() => handleOpenFolder(folder.path)}
                  className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-emerald-500 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen className="w-5 h-5 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate group-hover:text-emerald-400">
                        {folder.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {mediaItems.filter(m => m.folder === folder.path).length} {lang === 'ar' ? 'ملفات' : 'fichiers'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder);
                    }}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition"
                    title={lang === 'ar' ? 'حذف المجلد' : 'Supprimer le dossier'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Media Items */}
          {loading ? (
            <div className="text-center py-16 bg-slate-950 rounded-xl border border-slate-800">
              <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400">{lang === 'ar' ? 'جاري تحميل الفيديوهات والوسائط...' : 'Chargement des médias...'}</p>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="text-center py-16 bg-slate-950 rounded-xl border border-dashed border-slate-800 p-6 space-y-3">
              <Video className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">
                {lang === 'ar' ? 'لا توجد فيديوهات أو وسائط في هذا المجلد' : 'Aucune vidéo disponible dans ce dossier'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {lang === 'ar' ? 'اضغط على زر "إضافة فيديو جديد" بالأعلى لرفع واستئناف نشر الفيديوهات التسويقية.' : 'Cliquez sur "Ajouter vidéo" ci-dessus pour ajouter une vidéo.'}
              </p>
              <button onClick={handleOpenAddVideo} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold inline-flex items-center gap-2 text-xs transition">
                <Plus className="w-4 h-4" />
                {lang === 'ar' ? 'إضافة فيديو جديد الآن' : 'Ajouter une vidéo'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMedia.map(item => {
                const isSelected = selectedItem?.id === item.id;
                const isVideo = item.file_type === 'video';
                const isPublished = item.status === 'published';

                return (
                  <div
                    key={item.id}
                    className={`group relative bg-slate-950 rounded-xl border transition-all overflow-hidden flex flex-col justify-between ${
                      isSelected 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md' 
                        : 'border-slate-800 hover:border-slate-700 shadow-sm'
                    }`}
                  >
                    {/* Media Header / Preview Thumbnail */}
                    <div 
                      onClick={() => setSelectedItem(item)}
                      className="h-40 bg-slate-900 flex items-center justify-center overflow-hidden relative cursor-pointer group"
                    >
                      {item.file_type === 'image' ? (
                        <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : isVideo ? (
                        <div className="relative w-full h-full bg-slate-900/90 flex flex-col items-center justify-center text-rose-400 p-4 text-center">
                          <div className="w-12 h-12 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Play className="w-6 h-6 text-rose-400 fill-rose-400 ms-0.5" />
                          </div>
                          <span className="text-xs font-bold text-slate-200 line-clamp-1">{item.title_ar || item.name}</span>
                          <span className="text-[10px] text-rose-400/80 font-mono mt-1">MP4 / VIDEO</span>
                        </div>
                      ) : (
                        <div className="text-center text-indigo-400 p-4">
                          <FileText className="w-10 h-10 mx-auto mb-1" />
                          <span className="text-[10px] font-bold bg-indigo-950 border border-indigo-800 text-indigo-400 px-2 py-0.5 rounded-full">PDF</span>
                        </div>
                      )}

                      {/* Status Tag Overlay */}
                      <div className="absolute top-2 start-2">
                        {isPublished ? (
                          <span className="bg-emerald-950/90 border border-emerald-600/60 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {lang === 'ar' ? 'منشورة حية' : 'Publié'}
                          </span>
                        ) : (
                          <span className="bg-slate-900/90 border border-slate-700 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {lang === 'ar' ? 'مسودة' : 'Brouillon'}
                          </span>
                        )}
                      </div>

                      {/* Quick Play/Preview Overlay Button */}
                      {isVideo && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenPreview(item); }}
                          className="absolute bottom-2 end-2 bg-slate-950/80 hover:bg-rose-600 text-white rounded-lg p-1.5 backdrop-blur-sm transition-colors shadow"
                          title={lang === 'ar' ? 'معاينة وتشغيل الفيديو' : 'Lire la vidéo'}
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                      )}
                    </div>

                    {/* Meta info & Actions Footer */}
                    <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between border-t border-slate-900">
                      <div>
                        <h4 className="text-xs font-bold text-slate-100 line-clamp-1" title={item.title_ar || item.name}>
                          {item.title_ar || item.name}
                        </h4>
                        {(item.description_ar || item.description_fr) && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                            {item.description_ar || item.description_fr}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                        <span>{formatFileSize(item.size_bytes)}</span>
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* Interactive Actions Toolbar */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                        {/* Publish / Unpublish Toggle */}
                        <button
                          onClick={() => handleTogglePublishMedia(item)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                            isPublished 
                              ? 'bg-amber-950/60 border border-amber-800 text-amber-300 hover:bg-amber-900/80'
                              : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300 hover:bg-emerald-900/80'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isPublished 
                            ? (lang === 'ar' ? 'سحب للمسودة' : 'Dépublier') 
                            : (lang === 'ar' ? 'نشر الفيديو' : 'Publier')}
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditMedia(item)}
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 transition"
                          title={lang === 'ar' ? 'تعديل البيانات' : 'Éditer'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Preview Player Button */}
                        <button
                          onClick={() => handleOpenPreview(item)}
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-indigo-400 transition"
                          title={lang === 'ar' ? 'معاينة وتشغيل' : 'Aperçu'}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteMedia(item.id, item.title_ar || item.name)}
                          className="p-1.5 rounded-lg border border-rose-950 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50 transition"
                          title={lang === 'ar' ? 'حذف الفيديو' : 'Supprimer'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Selected Item Detail Panel */}
        <div className="md:col-span-1 bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 h-fit text-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-100 text-sm border-b border-slate-800 pb-2 flex items-center justify-between">
            <span>{lang === 'ar' ? 'معاينة وتفاصيل الملف' : 'Détails du fichier'}</span>
            {selectedItem?.file_type === 'video' && <Video className="w-4 h-4 text-rose-400" />}
          </h3>

          {selectedItem ? (
            <div className="space-y-4">
              {/* Media Preview Box */}
              <div className="rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-800 relative min-h-[160px]">
                {selectedItem.file_type === 'image' ? (
                  <img src={selectedItem.url} alt={selectedItem.name} className="max-h-48 w-full object-contain" />
                ) : selectedItem.file_type === 'video' ? (
                  <video src={selectedItem.url} controls className="w-full max-h-48 rounded-lg" />
                ) : (
                  <FileText className="w-16 h-16 text-indigo-400" />
                )}
              </div>

              {/* Title & Status */}
              <div>
                <p className="text-xs font-bold text-slate-100">{selectedItem.title_ar || selectedItem.name}</p>
                {selectedItem.title_fr && <p className="text-[11px] text-slate-400">{selectedItem.title_fr}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    selectedItem.status === 'published' 
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800' 
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}>
                    {selectedItem.status === 'published' ? (lang === 'ar' ? 'منشورة حية' : 'Publié') : (lang === 'ar' ? 'مسودة' : 'Brouillon')}
                  </span>
                </div>
              </div>

              {/* Details Metadata */}
              <div className="space-y-2 text-xs border-t border-slate-800/80 pt-3">
                <div>
                  <span className="text-slate-500 block text-[10px]">{lang === 'ar' ? 'المجلد:' : 'Dossier:'}</span>
                  <span className="font-semibold text-slate-300">{selectedItem.folder}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">{lang === 'ar' ? 'الحجم والتنسيق:' : 'Taille & Format:'}</span>
                  <span className="font-semibold text-slate-300">{formatFileSize(selectedItem.size_bytes)} ({selectedItem.mime_type})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">{lang === 'ar' ? 'تاريخ الإنشاء:' : 'Date de création:'}</span>
                  <span className="font-semibold text-slate-300">{new Date(selectedItem.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-3 border-t border-slate-800">
                {onSelectMedia && (
                  <button
                    onClick={() => onSelectMedia(selectedItem.url)}
                    className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 flex items-center justify-center gap-1.5 transition"
                  >
                    <Check className="w-4 h-4" />
                    {lang === 'ar' ? 'اختيار وإدراج في الصفحة' : 'Sélectionner'}
                  </button>
                )}

                <button
                  onClick={() => handleTogglePublishMedia(selectedItem)}
                  className={`w-full rounded-lg text-xs font-bold py-2 flex items-center justify-center gap-1.5 transition ${
                    selectedItem.status === 'published'
                      ? 'bg-amber-950/80 border border-amber-800 text-amber-300 hover:bg-amber-900'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  {selectedItem.status === 'published'
                    ? (lang === 'ar' ? 'سحب الفيديو من النشر' : 'Dépublier la vidéo')
                    : (lang === 'ar' ? 'نشر الفيديو الآن' : 'Publier la vidéo')}
                </button>

                <button
                  onClick={() => copyUrlToClipboard(selectedItem.url)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold py-1.5 flex items-center justify-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'نسخ رابط الفيديو المباشر' : 'Copier le lien vidéo'}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEditMedia(selectedItem)}
                    className="flex-1 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold py-1.5 flex items-center justify-center gap-1 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'تعديل' : 'Éditer'}
                  </button>
                  <button
                    onClick={() => handleDeleteMedia(selectedItem.id, selectedItem.title_ar || selectedItem.name)}
                    className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg border border-slate-800 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              {lang === 'ar' ? 'انقر على أي فيديو أو ملف لمعاينة تفاصيله وتغيير حالة نشره.' : 'Cliquez sur un fichier pour afficher les détails.'}
            </div>
          )}
        </div>
      </div>

      {/* Add / Upload Video Modal */}
      {(showAddVideoModal || showEditMediaModal) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl border border-slate-800 text-slate-100 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Video className="w-5 h-5 text-rose-400" />
                {showEditMediaModal 
                  ? (lang === 'ar' ? 'تعديل بيانات واستبدال ملف الفيديو / الوسائط' : 'Éditer / Remplacer le média')
                  : (lang === 'ar' ? 'رفع وتنظيم فيديو جديد من حاسوبك' : 'Ajouter une nouvelle vidéo')}
              </h3>
              <button 
                onClick={() => { setShowAddVideoModal(false); setShowEditMediaModal(false); setEditingMediaItem(null); }} 
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Computer File Drag Drop & Upload Box */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  {lang === 'ar' ? 'ملف الفيديو أو الصورة من جهازك (رفع مباشر)' : 'Fichier vidéo ou image depuis votre ordinateur'}
                </label>

                {/* Dropzone / Upload Control */}
                <div 
                  onClick={() => modalFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-rose-500 bg-slate-950 p-4 rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
                >
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept="video/*,image/*,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  {uploading ? (
                    <div className="py-3 flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 text-rose-400 animate-spin" />
                      <span className="text-xs font-semibold text-slate-300">
                        {lang === 'ar' ? 'جاري رفع الملف إلى الخادم وسحابه Storage...' : 'Téléversement en cours...'}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-rose-600/10 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-200">
                          {lang === 'ar' ? 'انقر لاختيار فيديو أو صورة من حاسوبك' : 'Cliquez pour choisir un fichier'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {lang === 'ar' ? 'يدعم فيديوهات MP4, WebM وصور PNG, JPG (حتى 100 ميجابايت)' : 'MP4, WebM, PNG, JPG jusqu\'à 100 Mo'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Live Preview Frame */}
              {mediaFormUrl && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="font-semibold text-slate-300">{lang === 'ar' ? 'معاينة حية للملف المرفوع:' : 'Aperçu du fichier:'}</span>
                    <button
                      onClick={() => modalFileInputRef.current?.click()}
                      className="text-rose-400 hover:underline flex items-center gap-1 font-bold text-[10px]"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {lang === 'ar' ? 'استبدال الملف بملف آخر' : 'Remplacer le fichier'}
                    </button>
                  </div>
                  <div className="rounded-xl bg-slate-950 overflow-hidden border border-slate-800 flex items-center justify-center max-h-48">
                    {mediaFormType === 'video' ? (
                      <video src={mediaFormUrl} controls className="w-full max-h-48 rounded-lg object-cover" />
                    ) : mediaFormType === 'image' ? (
                      <img src={mediaFormUrl} alt="Preview" className="max-h-48 object-contain" />
                    ) : (
                      <div className="p-4 text-center text-slate-300">
                        <FileText className="w-10 h-10 text-indigo-400 mx-auto mb-1" />
                        <span className="text-xs">PDF Document</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Type Select */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{lang === 'ar' ? 'نوع الوسائط' : 'Type de média'}</label>
                <select
                  value={mediaFormType}
                  onChange={(e) => setMediaFormType(e.target.value as 'video' | 'image' | 'pdf')}
                  className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-rose-500"
                >
                  <option value="video">🎬 فيديو (Video / MP4)</option>
                  <option value="image">📷 صورة (Image)</option>
                  <option value="pdf">📄 مستند (PDF / Document)</option>
                </select>
              </div>

              {/* Title Arabic */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{lang === 'ar' ? 'عنوان الفيديو / الملف (بالعربية)' : 'Titre (Arabe)'}</label>
                <input
                  type="text"
                  value={mediaFormTitleAr}
                  onChange={(e) => setMediaFormTitleAr(e.target.value)}
                  placeholder="مثال: فيديو شرح طريقة التوصيل والدفع عند الاستلام"
                  className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Title French */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{lang === 'ar' ? 'عنوان الفيديو (بالفرنسية)' : 'Titre (Français)'}</label>
                <input
                  type="text"
                  value={mediaFormTitleFr}
                  onChange={(e) => setMediaFormTitleFr(e.target.value)}
                  placeholder="Ex: Vidéo explicative sur la livraison"
                  className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Description Arabic */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{lang === 'ar' ? 'الوصف التوضيحي (بالعربية)' : 'Description (Arabe)'}</label>
                <textarea
                  rows={2}
                  value={mediaFormDescAr}
                  onChange={(e) => setMediaFormDescAr(e.target.value)}
                  placeholder="شرح مختصر لمحتوى الفيديو والاستفادة منه..."
                  className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Folder & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{lang === 'ar' ? 'المجلد الحاضن' : 'Dossier'}</label>
                  <select
                    value={mediaFormFolder}
                    onChange={(e) => setMediaFormFolder(e.target.value)}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-rose-500"
                  >
                    <option value="/videos">/videos (فيديوهات)</option>
                    <option value="/banners">/banners (بنرات)</option>
                    <option value="/policies">/policies (سياسات)</option>
                    <option value="/">/ (الرئيسية)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{lang === 'ar' ? 'حالة النشر على الصفحة الرئيسية' : 'Statut'}</label>
                  <select
                    value={mediaFormStatus}
                    onChange={(e) => setMediaFormStatus(e.target.value as 'published' | 'draft')}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-rose-500"
                  >
                    <option value="published">منشورة حية (Published)</option>
                    <option value="draft">مسودة حصرية (Draft)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button 
                onClick={() => { setShowAddVideoModal(false); setShowEditMediaModal(false); setEditingMediaItem(null); }} 
                className="px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
              >
                {lang === 'ar' ? 'إلغاء' : 'Annuler'}
              </button>
              <button 
                onClick={handleSaveVideoMedia} 
                disabled={uploading || !mediaFormUrl}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {showEditMediaModal 
                  ? (lang === 'ar' ? 'حفظ التعديلات' : 'Enregistrer') 
                  : (lang === 'ar' ? 'حفظ ونشر الفيديو' : 'Publier la vidéo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video / Media Player Preview Modal */}
      {showPreviewModal && previewMediaItem && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-3xl w-full overflow-hidden border border-slate-800 shadow-2xl space-y-4">
            <div className="p-4 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-100">{previewMediaItem.title_ar || previewMediaItem.name}</h3>
                  <p className="text-[10px] text-slate-400">{previewMediaItem.folder} | {formatFileSize(previewMediaItem.size_bytes)}</p>
                </div>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-black flex items-center justify-center">
              {previewMediaItem.file_type === 'video' ? (
                <video src={previewMediaItem.url} controls autoPlay className="w-full max-h-[60vh] rounded-xl shadow-2xl" />
              ) : previewMediaItem.file_type === 'image' ? (
                <img src={previewMediaItem.url} alt={previewMediaItem.name} className="max-h-[60vh] object-contain rounded-xl" />
              ) : (
                <div className="text-center py-12 text-slate-300">
                  <FileText className="w-16 h-16 text-indigo-400 mx-auto mb-2" />
                  <a href={previewMediaItem.url} target="_blank" rel="noreferrer" className="btn-primary inline-block text-xs">
                    فتح المستند PDF
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950 text-xs">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                previewMediaItem.status === 'published' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-900 text-slate-400 border border-slate-700'
              }`}>
                {previewMediaItem.status === 'published' ? 'منشورة حية' : 'مسودة'}
              </span>
              <button 
                onClick={() => copyUrlToClipboard(previewMediaItem.url)}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'نسخ رابط الفيديو' : 'Copier le lien'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-400" />
                {lang === 'ar' ? 'إنشاء مجلد جديد' : 'Créer un dossier'}
              </h3>
              <button onClick={() => setShowNewFolderModal(false)} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{lang === 'ar' ? 'اسم المجلد' : 'Nom du dossier'}</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: فيديوهات عروض الشتاء' : 'Ex: Offres Hiver'}
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setShowNewFolderModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition">{lang === 'ar' ? 'إلغاء' : 'Annuler'}</button>
              <button onClick={handleCreateFolder} className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition">{lang === 'ar' ? 'إنشاء' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MEDIA DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetMedia}
        onClose={() => setDeleteTargetMedia(null)}
        onConfirm={handleConfirmDeleteMedia}
        isDeleting={isDeletingMedia}
        itemName={deleteTargetMedia?.name}
        error={deleteMediaError}
      />

      {/* FOLDER DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetFolder}
        onClose={() => setDeleteTargetFolder(null)}
        onConfirm={handleConfirmDeleteFolder}
        isDeleting={isDeletingFolder}
        itemName={deleteTargetFolder?.name}
        title={lang === 'ar' ? 'تأكيد حذف المجلد' : 'Confirmer la suppression du dossier'}
        description={lang === 'ar' ? `هل أنت متأكد من حذف المجلد "${deleteTargetFolder?.name}"؟` : `Supprimer le dossier "${deleteTargetFolder?.name}" ?`}
        error={deleteFolderError}
      />
    </div>
  );
}
