import { useState } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Video, Table, Code, Eye, 
  Heading1, Heading2, Heading3, ArrowLeftRight, X
} from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  dir?: 'rtl' | 'ltr';
  placeholder?: string;
  onOpenMediaLibrary?: () => void;
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  dir = 'rtl', 
  placeholder,
  onOpenMediaLibrary 
}: RichTextEditorProps) {
  const { lang } = useLanguage();
  const [editorDir, setEditorDir] = useState<'rtl' | 'ltr'>(dir);
  const [showCodeView, setShowCodeView] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);

  // Link form
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkNewTab, setLinkNewTab] = useState(true);

  // Image form
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');

  // Video form
  const [videoUrl, setVideoUrl] = useState('');

  // Table form
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const appendHtml = (htmlToInsert: string) => {
    onChange(value + (value ? '\n' : '') + htmlToInsert);
  };

  const wrapTag = (openTag: string, closeTag: string) => {
    onChange(`${value}${openTag}${lang === 'ar' ? 'نص جديد' : 'Texte'}${closeTag}`);
  };

  const handleInsertLink = () => {
    if (!linkUrl) return;
    const target = linkNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
    const text = linkText || linkUrl;
    appendHtml(`<a href="${linkUrl}"${target} class="text-emerald-600 hover:underline font-semibold">${text}</a>`);
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  const handleInsertImage = () => {
    if (!imageUrl) return;
    appendHtml(`<img src="${imageUrl}" alt="${imageAlt || 'Image'}" class="w-full max-w-2xl h-auto rounded-xl shadow-sm my-4 object-cover" />`);
    setShowImageModal(false);
    setImageUrl('');
    setImageAlt('');
  };

  const handleInsertVideo = () => {
    if (!videoUrl) return;
    let embedUrl = videoUrl;
    if (videoUrl.includes('youtube.com/watch?v=')) {
      embedUrl = videoUrl.replace('watch?v=', 'embed/');
    } else if (videoUrl.includes('youtu.be/')) {
      embedUrl = videoUrl.replace('youtu.be/', 'youtube.com/embed/');
    }
    appendHtml(`
      <div className="relative aspect-video w-full max-w-3xl my-4 rounded-xl overflow-hidden shadow-sm bg-black">
        <iframe src="${embedUrl}" class="w-full h-full border-0" allowfullscreen></iframe>
      </div>
    `);
    setShowVideoModal(false);
    setVideoUrl('');
  };

  const handleInsertTable = () => {
    let tableHtml = `<div class="overflow-x-auto my-4"><table class="w-full text-xs text-slate-700 dark:text-slate-200 border-collapse border border-slate-200 dark:border-slate-700"><thead><tr class="bg-slate-100 dark:bg-slate-800">`;
    for (let c = 1; c <= tableCols; c++) {
      tableHtml += `<th class="border border-slate-200 dark:border-slate-700 px-3 py-2 text-start font-bold">${lang === 'ar' ? 'عمود' : 'Colonne'} ${c}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;
    for (let r = 1; r <= tableRows; r++) {
      tableHtml += `<tr>`;
      for (let c = 1; c <= tableCols; c++) {
        tableHtml += `<td class="border border-slate-200 dark:border-slate-700 px-3 py-2">${lang === 'ar' ? 'خلية' : 'Cellule'} ${r}-${c}</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table></div>`;
    appendHtml(tableHtml);
    setShowTableModal(false);
  };

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-900 border-b border-slate-800 text-slate-300">
        {/* Headings */}
        <button
          type="button"
          onClick={() => wrapTag('<h1>', '</h1>')}
          className="p-1.5 hover:bg-slate-800 rounded text-xs font-bold flex items-center gap-0.5 text-slate-200"
          title="H1 Title"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => wrapTag('<h2>', '</h2>')}
          className="p-1.5 hover:bg-slate-800 rounded text-xs font-bold flex items-center gap-0.5 text-slate-200"
          title="H2 Subtitle"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => wrapTag('<h3>', '</h3>')}
          className="p-1.5 hover:bg-slate-800 rounded text-xs font-bold flex items-center gap-0.5 text-slate-200"
          title="H3 Section"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Text Styling */}
        <button
          type="button"
          onClick={() => wrapTag('<strong>', '</strong>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => wrapTag('<em>', '</em>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => wrapTag('<u>', '</u>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Underline"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => wrapTag('<s>', '</s>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Alignments */}
        <button
          type="button"
          onClick={() => wrapTag('<div class="text-start">', '</div>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Align Left / Start"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => wrapTag('<div class="text-center">', '</div>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => wrapTag('<div class="text-end">', '</div>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Align Right / End"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => wrapTag('<div class="text-justify">', '</div>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => appendHtml('<ul class="list-disc ms-5 space-y-1 my-2"><li>' + (lang === 'ar' ? 'عنصر القائمة' : 'Élément') + '</li></ul>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Bulleted List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => appendHtml('<ol class="list-decimal ms-5 space-y-1 my-2"><li>' + (lang === 'ar' ? 'الخطوة الأولى' : 'Étape 1') + '</li></ol>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Inserts */}
        <button
          type="button"
          onClick={() => setShowLinkModal(true)}
          className="p-1.5 hover:bg-slate-800 rounded text-emerald-400"
          title="Insert Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (onOpenMediaLibrary) {
              onOpenMediaLibrary();
            } else {
              setShowImageModal(true);
            }
          }}
          className="p-1.5 hover:bg-slate-800 rounded text-indigo-400"
          title="Insert Image (or Media Library)"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowVideoModal(true)}
          className="p-1.5 hover:bg-slate-800 rounded text-rose-400"
          title="Insert Video"
        >
          <Video className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowTableModal(true)}
          className="p-1.5 hover:bg-slate-800 rounded text-blue-400"
          title="Insert Table"
        >
          <Table className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => wrapTag('<pre class="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-xs overflow-x-auto my-2"><code>', '</code></pre>')}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
          title="Code Block"
        >
          <Code className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Direction Toggle */}
        <button
          type="button"
          onClick={() => setEditorDir(prev => prev === 'rtl' ? 'ltr' : 'rtl')}
          className={`p-1.5 rounded text-xs font-bold flex items-center gap-1 ${
            editorDir === 'rtl' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80' : 'bg-slate-800 text-slate-200 border border-slate-700'
          }`}
          title="Toggle Direction RTL / LTR"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          {editorDir.toUpperCase()}
        </button>

        {/* Source Code Toggle */}
        <button
          type="button"
          onClick={() => setShowCodeView(!showCodeView)}
          className={`ms-auto p-1.5 rounded text-xs font-semibold flex items-center gap-1 ${
            showCodeView ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-300'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          {showCodeView ? 'Visual' : 'HTML'}
        </button>
      </div>

      {/* Main Textarea / Preview Box */}
      <div className="p-3 bg-slate-950" dir={editorDir}>
        {showCodeView ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={12}
            className="w-full font-mono text-xs p-3 bg-slate-900 text-emerald-400 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
            placeholder="<html>..."
          />
        ) : (
          <div className="space-y-2">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={12}
              className="w-full text-xs sm:text-sm p-3 bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none resize-y border-0"
              placeholder={placeholder || (lang === 'ar' ? 'اكتب المحتوى هنا... يمكنك إضافة عناوين، صور، جداول، وروابط.' : 'Rédigez votre contenu ici...')}
            />
          </div>
        )}
      </div>

      {/* Insert Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-emerald-400" />
                {lang === 'ar' ? 'إدراج رابط' : 'Insérer un lien'}
              </h3>
              <button onClick={() => setShowLinkModal(false)} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{lang === 'ar' ? 'رابط الموقع (URL)' : 'URL'}</label>
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" placeholder="https://..." dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{lang === 'ar' ? 'نص الرابط' : 'Texte du lien'}</label>
                <input value={linkText} onChange={(e) => setLinkText(e.target.value)} className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" placeholder={lang === 'ar' ? 'انقر هنا' : 'Cliquer ici'} />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" checked={linkNewTab} onChange={(e) => setLinkNewTab(e.target.checked)} className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500" />
                {lang === 'ar' ? 'فتح في تبويب جديد' : 'Ouvrir dans un nouvel onglet'}
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setShowLinkModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition">{lang === 'ar' ? 'إلغاء' : 'Annuler'}</button>
              <button onClick={handleInsertLink} className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition">{lang === 'ar' ? 'إدراج' : 'Insérer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Insert Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                {lang === 'ar' ? 'إدراج صورة' : 'Insérer une image'}
              </h3>
              <button onClick={() => setShowImageModal(false)} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{lang === 'ar' ? 'رابط الصورة (URL)' : 'URL de l\'image'}</label>
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono" placeholder="https://..." dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{lang === 'ar' ? 'النص البديل (Alt)' : 'Texte alternatif'}</label>
                <input value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" placeholder={lang === 'ar' ? 'وصف الصورة' : 'Description'} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setShowImageModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition">{lang === 'ar' ? 'إلغاء' : 'Annuler'}</button>
              <button onClick={handleInsertImage} className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition">{lang === 'ar' ? 'إدراج' : 'Insérer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Insert Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Video className="w-4 h-4 text-rose-400" />
                {lang === 'ar' ? 'إدراج فيديو' : 'Insérer une vidéo'}
              </h3>
              <button onClick={() => setShowVideoModal(false)} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{lang === 'ar' ? 'رابط YouTube / Vimeo' : 'Lien Vidéo'}</label>
                <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono" placeholder="https://www.youtube.com/watch?v=..." dir="ltr" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setShowVideoModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition">{lang === 'ar' ? 'إلغاء' : 'Annuler'}</button>
              <button onClick={handleInsertVideo} className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition">{lang === 'ar' ? 'إدراج' : 'Insérer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Insert Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Table className="w-4 h-4 text-blue-400" />
                {lang === 'ar' ? 'إنشاء جدول' : 'Créer un tableau'}
              </h3>
              <button onClick={() => setShowTableModal(false)} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{lang === 'ar' ? 'عدد الصفوف' : 'Lignes'}</label>
                <input type="number" min={1} max={20} value={tableRows} onChange={(e) => setTableRows(Number(e.target.value))} className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{lang === 'ar' ? 'عدد الأعمدة' : 'Colonnes'}</label>
                <input type="number" min={1} max={10} value={tableCols} onChange={(e) => setTableCols(Number(e.target.value))} className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setShowTableModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition">{lang === 'ar' ? 'إلغاء' : 'Annuler'}</button>
              <button onClick={handleInsertTable} className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition">{lang === 'ar' ? 'إنشاء' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
