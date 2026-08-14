import { useState, useEffect, useCallback } from 'react';
import {
  Share2, CheckCircle2, AlertTriangle, RefreshCw, Layers,
  ShoppingBag, FileText, ExternalLink,
  ShieldCheck, Zap, PlusCircle, Check, X,
  Instagram, Facebook, Store, HelpCircle
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';
import {
  MetaConfig, MetaSyncLog, defaultConfig, getMetaConfig, saveMetaConfig,
  getSyncLogs, fetchMetaOAuthUrl, exchangeMetaCode, fetchMetaPages,
  fetchMetaCatalogs, createMetaCatalog, syncProductsToMetaCatalog,
  checkMetaTokenStatus, MetaApiError, MetaApiErrorDetails
} from '../../lib/metaCommerceService';

export default function AdminSocialCommerce() {
  const { tr, lang } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'connection' | 'accounts' | 'sync' | 'logs'>('connection');
  const [config, setConfig] = useState<MetaConfig>(defaultConfig);
  const [logs, setLogs] = useState<MetaSyncLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Connection & OAuth states
  const [isConnecting, setIsConnecting] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [appIdInput, setAppIdInput] = useState('');
  const [appSecretInput, setAppSecretInput] = useState('');

  // Page / Catalog selection options
  const [fetchedPages, setFetchedPages] = useState<Array<{
    id: string;
    name: string;
    access_token: string;
    category?: string;
    instagram_business_account?: { id: string; username: string; name: string };
  }>>([]);
  const [fetchedBusinesses, setFetchedBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [fetchedCatalogs, setFetchedCatalogs] = useState<Array<{ id: string; name: string; product_count?: number }>>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // New catalog modal
  const [showNewCatalogModal, setShowNewCatalogModal] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState('Business Market Commerce Catalog');
  const [catalogModalBusinessId, setCatalogModalBusinessId] = useState('');
  const [catalogErrorDetails, setCatalogErrorDetails] = useState<MetaApiErrorDetails | null>(null);
  const [creatingCatalog, setCreatingCatalog] = useState(false);

  // Sync execution state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // Selected Log detail modal
  const [selectedLog, setSelectedLog] = useState<MetaSyncLog | null>(null);

  const checkTokenAndLoadAccounts = useCallback(async (currentConfig: MetaConfig) => {
    setLoadingAccounts(true);
    try {
      const token = currentConfig.accessToken;
      if (!token) return;

      const statusRes = await checkMetaTokenStatus(token);
      if (!statusRes.connected) {
        showToast(
          tr('انتهت صلاحية رمز الوصول لـ Meta. يرجى إعادة الاتصال.', 'Le jeton d\'accès Meta a expiré. Veuillez vous reconnecter.'),
          'error'
        );
        currentConfig.lastSyncStatus = 'failed';
        await saveMetaConfig(currentConfig);
        setConfig({ ...currentConfig });
        return;
      }

      // Fetch Facebook Pages & IG Accounts
      const pages = await fetchMetaPages(token);
      setFetchedPages(pages);

      // Fetch Catalogs
      const catRes = await fetchMetaCatalogs(token, currentConfig.selectedBusinessId);
      setFetchedBusinesses(catRes.businesses || []);
      setFetchedCatalogs(catRes.catalogs || []);

      // If page was previously selected, refresh its token
      if (currentConfig.selectedPageId && pages.length > 0) {
        const found = pages.find((p: { id: string }) => p.id === currentConfig.selectedPageId);
        if (found) {
          currentConfig.selectedPageName = found.name;
          currentConfig.selectedPageAccessToken = found.access_token;
          if (found.instagram_business_account) {
            currentConfig.selectedInstagramId = found.instagram_business_account.id;
            currentConfig.selectedInstagramUsername = found.instagram_business_account.username || found.instagram_business_account.name;
          }
          await saveMetaConfig(currentConfig);
          setConfig({ ...currentConfig });
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('[Meta Accounts Fetch Error]:', error);
    } finally {
      setLoadingAccounts(false);
    }
  }, [showToast, tr]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const loadedConfig = await getMetaConfig();
      setConfig(loadedConfig);
      setAppIdInput(loadedConfig.appId);
      setAppSecretInput(loadedConfig.appSecret);

      const loadedLogs = await getSyncLogs();
      setLogs(loadedLogs);

      // Fetch products from Supabase
      const { data: prods } = await supabase.from('products').select('*');
      if (prods) setProducts(prods as Product[]);

      // If connected, check token status & reload pages/catalogs
      if (loadedConfig.accessToken) {
        checkTokenAndLoadAccounts(loadedConfig);
      }
    } catch (err) {
      console.error('[AdminSocialCommerce] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [checkTokenAndLoadAccounts]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for OAuth Popup PostMessage
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'META_OAUTH_SUCCESS') {
        const { code } = event.data;
        showToast(
          tr('تم استلام رمز التفويض من Meta! جاري تأكيد الاتصال...', 'Code d\'autorisation Meta reçu! Validation en cours...'),
          'info'
        );
        try {
          setIsConnecting(true);
          const targetAppId = appIdInput || config.appId;
          const targetAppSecret = appSecretInput || config.appSecret;
          const exchanged = await exchangeMetaCode(code, targetAppId, targetAppSecret);
          const updatedConfig: MetaConfig = {
            ...config,
            appId: targetAppId,
            appSecret: targetAppSecret,
            hasAppSecret: true,
            accessToken: exchanged.accessToken,
            connectedUser: exchanged.user || null,
            lastSyncStatus: 'idle',
          };
          await saveMetaConfig(updatedConfig);
          setConfig(updatedConfig);

          showToast(
            tr('تم الربط بـ Meta بنجاح!', 'Connexion Meta réussie !'),
            'success'
          );

          await checkTokenAndLoadAccounts(updatedConfig);
          setActiveTab('accounts');
        } catch (err: unknown) {
          const error = err as Error;
          showToast(error.message || tr('فشل تبادل رمز التفويض مع Meta', 'Échec de l\'échange de jeton Meta'), 'error');
        } finally {
          setIsConnecting(false);
        }
      } else if (event.data?.type === 'META_OAUTH_ERROR') {
        showToast(
          tr(`فشل تسديد الدخول عبر Meta: ${event.data.error}`, `Erreur OAuth Meta: ${event.data.error}`),
          'error'
        );
        setIsConnecting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [appIdInput, appSecretInput, config, checkTokenAndLoadAccounts, showToast, tr]);

  // Initiate Official Meta OAuth Popup Flow
  const handleStartMetaOAuth = async () => {
    if (!appIdInput) {
      showToast(tr('يرجى إدخال Meta App ID أولاً.', 'Veuillez d\'abord saisir le Meta App ID.'), 'error');
      return;
    }

    setIsConnecting(true);
    try {
      const authUrl = await fetchMetaOAuthUrl(appIdInput);
      
      const width = 600;
      const height = 750;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        'MetaCommerceOAuth',
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
      );

      if (!popup) {
        showToast(
          tr('تم حظر النافذة المنبثقة من قبل المتصفح. يرجى السماح بالنوافذ المنبثقة.', 'Le navigateur a bloqué la fenêtre pop-up. Veuillez autoriser les pop-ups.'),
          'error'
        );
        setIsConnecting(false);
      }
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || tr('فشل إطلاق الاتصال بـ Meta', 'Échec du lancement OAuth Meta'), 'error');
      setIsConnecting(false);
    }
  };

  // Manual Token Save Handler
  const handleSaveManualToken = async () => {
    if (!manualToken.trim()) {
      showToast(tr('يرجى إدخال Access Token صالح.', 'Veuillez saisir un Access Token valide.'), 'error');
      return;
    }

    setIsConnecting(true);
    try {
      const status = await checkMetaTokenStatus(manualToken.trim());
      if (!status.connected) {
        showToast(tr('رمز الوصول غير صالح أو منتهي الصلاحية.', 'Le jeton d\'accès est invalide ou expiré.'), 'error');
        setIsConnecting(false);
        return;
      }

      const updatedConfig: MetaConfig = {
        ...config,
        appId: appIdInput,
        appSecret: appSecretInput,
        accessToken: manualToken.trim(),
        connectedUser: status.user || { id: 'meta_user', name: 'Meta Admin' },
      };

      await saveMetaConfig(updatedConfig);
      setConfig(updatedConfig);
      setManualToken('');

      showToast(tr('تم حفظ رمز الوصول والربط بنجاح!', 'Jeton d\'accès enregistré avec succès !'), 'success');
      await checkTokenAndLoadAccounts(updatedConfig);
      setActiveTab('accounts');
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || tr('فشل التحقق من رمز الوصول', 'Échec de vérification du jeton'), 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Save App Credentials
  const handleSaveAppCredentials = async () => {
    const updated = {
      ...config,
      appId: appIdInput,
      appSecret: appSecretInput
    };
    await saveMetaConfig(updated);
    setConfig(updated);
    showToast(tr('تم حفظ إعدادات تطبيق Meta بنجاح.', 'Identifiants de l\'application Meta enregistrés.'), 'success');
  };

  // Disconnect Meta Integration
  const handleDisconnect = async () => {
    if (!window.confirm(tr('هل أنت متأكد من رغبتك في إيقاف الربط مع Meta؟', 'Êtes-vous sûr de vouloir déconnecter Meta ?'))) {
      return;
    }

    const reset = { ...defaultConfig, appId: config.appId, appSecret: config.appSecret };
    await saveMetaConfig(reset);
    setConfig(reset);
    setFetchedPages([]);
    setFetchedCatalogs([]);
    setFetchedBusinesses([]);
    showToast(tr('تم إيقاف الربط مع Meta بنجاح.', 'Déconnexion de Meta réussie.'), 'info');
  };

  // Page Selection Change
  const handleSelectPage = async (pageId: string) => {
    const page = fetchedPages.find(p => p.id === pageId);
    if (!page) return;

    const updated: MetaConfig = {
      ...config,
      selectedPageId: page.id,
      selectedPageName: page.name,
      selectedPageAccessToken: page.access_token,
      selectedInstagramId: page.instagram_business_account?.id || '',
      selectedInstagramUsername: page.instagram_business_account?.username || page.instagram_business_account?.name || '',
    };

    await saveMetaConfig(updated);
    setConfig(updated);
    showToast(
      tr(`تم اختيار صفحة Facebook: ${page.name}`, `Page Facebook sélectionnée: ${page.name}`),
      'success'
    );
  };

  // Catalog Selection Change
  const handleSelectCatalog = async (catId: string) => {
    const cat = fetchedCatalogs.find(c => c.id === catId);
    const updated: MetaConfig = {
      ...config,
      selectedCatalogId: catId,
      selectedCatalogName: cat?.name || catId,
    };

    await saveMetaConfig(updated);
    setConfig(updated);
    showToast(
      tr(`تم تحديد الكتالوج: ${updated.selectedCatalogName}`, `Catalogue sélectionné: ${updated.selectedCatalogName}`),
      'success'
    );
  };

  // Business Selection Change
  const handleSelectBusiness = async (bizId: string) => {
    const updated: MetaConfig = {
      ...config,
      selectedBusinessId: bizId,
    };
    await saveMetaConfig(updated);
    setConfig(updated);
    await checkTokenAndLoadAccounts(updated);
  };

  // Create New Catalog
  const handleCreateCatalog = async () => {
    if (!newCatalogName.trim()) return;

    setCreatingCatalog(true);
    setCatalogErrorDetails(null);

    const businessIdToUse = catalogModalBusinessId.trim() || config.selectedBusinessId || (fetchedBusinesses[0]?.id || '');

    try {
      const created = await createMetaCatalog(
        config.accessToken,
        businessIdToUse,
        newCatalogName.trim()
      );

      const updatedCatalogs = [...fetchedCatalogs, created];
      setFetchedCatalogs(updatedCatalogs);

      const updatedConfig = {
        ...config,
        selectedBusinessId: businessIdToUse || created.businessId || config.selectedBusinessId,
        selectedCatalogId: created.id,
        selectedCatalogName: created.name
      };

      await saveMetaConfig(updatedConfig);
      setConfig(updatedConfig);
      setShowNewCatalogModal(false);
      setCatalogErrorDetails(null);

      showToast(
        tr(`تم إنشاء كتالوج المنتجات الجديد بنجاح (ID: ${created.id})`, `Nouveau catalogue créé avec succès (ID: ${created.id})`),
        'success'
      );
    } catch (err: unknown) {
      if (err instanceof MetaApiError) {
        setCatalogErrorDetails(err.details || { message: err.message });
        showToast(err.message || tr('فشل إنشاء الكتالوج في Meta', 'Échec de la création du catalogue Meta'), 'error');
      } else {
        const error = err as Error;
        setCatalogErrorDetails({ message: error.message });
        showToast(error.message || tr('فشل إنشاء الكتالوج', 'Échec de la création du catalogue'), 'error');
      }
    } finally {
      setCreatingCatalog(false);
    }
  };

  // Manual Trigger: Synchronize Products Now
  const handleTriggerSyncNow = async () => {
    if (!config.accessToken || !config.selectedCatalogId) {
      showToast(
        tr('يرجى التأكد من الاتصال وتحديد الكتالوج أولاً قبل المزامنة.', 'Veuillez d\'abord connecter Meta et sélectionner un catalogue.'),
        'error'
      );
      setActiveTab('accounts');
      return;
    }

    if (products.length === 0) {
      showToast(tr('لا توجد منتجات في المتجر للمزامنة.', 'Aucun produit disponible pour la synchronisation.'), 'error');
      return;
    }

    setIsSyncing(true);
    setSyncProgress(10);

    try {
      const interval = setInterval(() => {
        setSyncProgress(p => (p < 90 ? p + 15 : p));
      }, 300);

      await syncProductsToMetaCatalog(config, products, 'manual');

      clearInterval(interval);
      setSyncProgress(100);

      // Refresh logs & config
      const updatedLogs = await getSyncLogs();
      setLogs(updatedLogs);
      const updatedConfig = await getMetaConfig();
      setConfig(updatedConfig);

      showToast(
        tr(
          `تمت مزامنة ${products.length} منتج بنجاح مع كتالوج Meta Commerce!`,
          `Synchronisation réussie de ${products.length} produits avec le catalogue Meta !`
        ),
        'success'
      );
    } catch (err: unknown) {
      const error = err as Error;
      const updatedLogs = await getSyncLogs();
      setLogs(updatedLogs);
      showToast(
        tr(`فشلت عملية المزامنة: ${error.message}`, `Échec de la synchronisation: ${error.message}`),
        'error'
      );
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(0);
      }, 600);
    }
  };

  // Toggle Auto-sync
  const handleToggleAutoSync = async (enabled: boolean) => {
    const updated = { ...config, autoSyncEnabled: enabled };
    await saveMetaConfig(updated);
    setConfig(updated);
    showToast(
      enabled
        ? tr('تم تفعيل المزامنة التلقائية للمنتجات مع Meta', 'Mise à jour automatique Meta activée')
        : tr('تم إيقاف المزامنة التلقائية', 'Mise à jour automatique désactivée'),
      'info'
    );
  };

  const isConnected = Boolean(config.accessToken);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-xs text-slate-400 font-semibold">{tr('جاري تحميل إعدادات Meta Social Commerce...', 'Chargement des paramètres Meta...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-2xl shadow-inner">
              <Share2 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-100">
                  {tr('التجارة الاجتماعية (Meta Integration)', 'Social Commerce (Meta Integration)')}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {isConnected ? tr('متصل بـ Meta', 'Connecté à Meta') : tr('غير متصل', 'Non connecté')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                {tr(
                  'ربط متجر Business Market مع Facebook Page و Instagram Business Account و Meta Catalog لعرض المنتجات ومزامنة المخزون والأسعار تلقائياً.',
                  'Connectez Business Market avec Facebook, Instagram et Meta Commerce Manager pour publier et synchroniser automatiquement votre catalogue.'
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTriggerSyncNow}
              disabled={isSyncing || !isConnected || !config.selectedCatalogId}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? tr('جاري المزامنة...', 'Synchronisation...') : tr('مزامنة المنتجات الآن', 'Mettre à jour le catalogue')}
            </button>
          </div>
        </div>

        {/* Progress Bar during Sync */}
        {isSyncing && (
          <div className="mt-5 space-y-1">
            <div className="flex justify-between text-xs text-slate-300 font-semibold">
              <span>{tr('جاري نقل البيانات إلى Meta Catalog...', 'Envoi des données vers Meta Catalog...')}</span>
              <span>{syncProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 space-x-reverse overflow-x-auto">
        <button
          onClick={() => setActiveTab('connection')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'connection'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4" />
          {tr('الاتصال ومفاتيح API', 'Connexion & API')}
        </button>

        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'accounts'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Store className="w-4 h-4" />
          {tr('الصفحات والكتالوج', 'Pages & Catalogue')}
          {config.selectedCatalogId && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'sync'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          {tr('مزامنة المنتجات', 'Synchronisation')}
          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px]">
            {products.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'logs'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          {tr('سجلات المزامنة والأخطاء', 'Historique & Erreurs')}
          {logs.some(l => l.status === 'failed') && (
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>
      </div>

      {/* TAB 1: CONNECTION & API */}
      {activeTab === 'connection' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Meta App Configuration Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Facebook className="w-6 h-6 text-blue-500" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {tr('تطبيق Meta Business (Meta App Credentials)', 'Identifiants de l\'application Meta')}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {tr('قم بإدخال App ID و App Secret الخاص بتطبيقك في Meta Developers.', 'Saisissez l\'App ID et l\'App Secret de votre application Meta Developers.')}
                    </p>
                  </div>
                </div>

                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  Meta Developers <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Meta App ID
                  </label>
                  <input
                    type="text"
                    value={appIdInput}
                    onChange={(e) => setAppIdInput(e.target.value)}
                    placeholder="e.g. 123456789012345"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Meta App Secret
                    </label>
                    {config.hasAppSecret && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full font-medium">
                        {tr('✓ تم التهيئة بأمان في الخادم', '✓ Configuré côté serveur')}
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={appSecretInput}
                    onChange={(e) => setAppSecretInput(e.target.value)}
                    placeholder={config.hasAppSecret ? (config.appSecretSnippet || tr('(المفتاح السري محفوظ بأمان)', '(Secret configuré)')) : '••••••••••••••••••••••••'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAppCredentials}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  {tr('حفظ المعرفات', 'Enregistrer les identifiants')}
                </button>
              </div>

              <hr className="border-slate-800/80 my-2" />

              {/* Official Meta OAuth Connect Action */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">
                      {tr('الربط المباشر بـ Meta OAuth Flow', 'Connexion directe OAuth Meta')}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {tr(
                        'لا يتطلب إدخال كلمة مرور. يتم التفويض بأمان من خلال النافذة المنبثقة الرسمية لـ Meta.',
                        'Aucun mot de passe n\'est requis. L\'autorisation s\'effectue en toute sécurité via la fenêtre officielle Meta.'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleStartMetaOAuth}
                    disabled={isConnecting}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-950/50 cursor-pointer disabled:opacity-50"
                  >
                    <Facebook className="w-4 h-4 fill-current" />
                    {isConnecting
                      ? tr('جاري الاتصال بـ Meta...', 'Connexion en cours...')
                      : tr('تسجيل الدخول والتوصيل مع Meta', 'Se connecter avec Meta')}
                  </button>

                  {isConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/50 px-3.5 py-2.5 rounded-xl font-semibold transition-colors cursor-pointer"
                    >
                      {tr('إلغاء الربط بـ Meta', 'Déconnecter Meta')}
                    </button>
                  )}
                </div>
              </div>

              {/* Fallback Manual Token Option */}
              <div className="pt-2">
                <details className="text-xs text-slate-400 space-y-3 cursor-pointer">
                  <summary className="font-semibold text-slate-300 hover:text-slate-100 transition-colors">
                    {tr('خيار متقدم: استخدام Access Token يدوي', 'Option avancée: Saisir un Access Token manuel')}
                  </summary>
                  <div className="pt-3 space-y-3">
                    <input
                      type="password"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder="EAABxxxxxxxxxxxxxxxx..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveManualToken}
                      disabled={isConnecting}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                    >
                      {tr('تأكيد وحفظ Token', 'Valider et enregistrer le jeton')}
                    </button>
                  </div>
                </details>
              </div>
            </div>
          </div>

          {/* Connection Overview Card */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                {tr('حالة الاتصال والحساب', 'Statut de la Connexion')}
              </h3>

              {isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                      {config.connectedUser?.name?.charAt(0) || 'M'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">{config.connectedUser?.name || 'Meta User'}</h4>
                      <p className="text-[11px] text-slate-400">ID: {config.connectedUser?.id || '—'}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">{tr('رمز الوصول', 'Jeton Access')}:</span>
                      <span className="font-mono text-emerald-400">
                        {config.accessToken ? `${config.accessToken.substring(0, 8)}...` : 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">{tr('صفحة Facebook', 'Page Facebook')}:</span>
                      <span className="font-semibold text-slate-200">
                        {config.selectedPageName || tr('غير محددة', 'Non définie')}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">{tr('حساب Instagram', 'Instagram')}:</span>
                      <span className="font-semibold text-slate-200">
                        {config.selectedInstagramUsername ? `@${config.selectedInstagramUsername}` : tr('غير مرتبط', 'Non lié')}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">{tr('كتالوج Meta', 'Catalogue Meta')}:</span>
                      <span className="font-semibold text-slate-200">
                        {config.selectedCatalogName || tr('غير محدد', 'Non défini')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto opacity-80" />
                  <p className="text-xs text-slate-400">
                    {tr('لم يتم ربط المتجر مع حساب Meta Business بعد.', 'Le magasin n\'est pas encore connecté à un compte Meta.')}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Helper Notes */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2 text-blue-400 font-bold mb-1">
                <HelpCircle className="w-4 h-4" />
                <span>{tr('المميزات والفوائد', 'Fonctionnalités')}</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                <li>{tr('مزامنة المنتجات مباشرة مع Facebook Shop و Instagram Shopping', 'Synchronisation directe avec Facebook Shop et Instagram Shopping')}</li>
                <li>{tr('تنسيق المخزون والأسعار التلقائي دون تعديل يدوي', 'Mise à jour automatique des prix et des stocks')}</li>
                <li>{tr('استخدام Meta Catalog في الحملات الإعلانية الموجهة', 'Utilisation du catalogue pour les publicités dynamique Meta Ads')}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNTS, PAGES & CATALOG SELECTOR */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          {!isConnected ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
              <Zap className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-100">
                {tr('يرجى الاتصال بـ Meta أولاً', 'Veuillez d\'abord vous connecter à Meta')}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {tr('قم بالانتقال إلى تبويب "الاتصال ومفاتيح API" لتسجيل الدخول وتوصيل الحساب.', 'Rendez-vous dans l\'onglet Connexion pour lier votre compte Meta.')}
              </p>
              <button
                onClick={() => setActiveTab('connection')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {tr('الانتقال لإعدادات الاتصال', 'Aller à la connexion')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Facebook Pages Selection */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl">
                      <Facebook className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">
                        {tr('صفحة Facebook المرتبطة', 'Page Facebook Cible')}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {tr('حدد صفحة Facebook التي ترغب في ربط منتجات المتجر بها.', 'Sélectionnez la page Facebook cible pour vos produits.')}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => checkTokenAndLoadAccounts(config)}
                    disabled={loadingAccounts}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                    title={tr('تحديث القائمة', 'Rafraîchir')}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingAccounts ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {fetchedPages.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center bg-slate-950 rounded-xl border border-slate-800">
                    {tr('لم يتم العثور على صفحات Facebook تديرها في هذا الحساب.', 'Aucune page Facebook trouvée sous ce compte.')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {fetchedPages.map((page) => {
                      const isSelected = config.selectedPageId === page.id;
                      return (
                        <div
                          key={page.id}
                          onClick={() => handleSelectPage(page.id)}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-950/40 border-blue-500/80 shadow-md'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                              {page.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-100">{page.name}</h4>
                              <p className="text-[11px] text-slate-400">ID: {page.id}</p>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="p-1.5 bg-blue-500 text-white rounded-full">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Linked Instagram Preview */}
                {config.selectedInstagramUsername && (
                  <div className="p-4 bg-gradient-to-r from-purple-950/40 to-pink-950/40 border border-purple-800/40 rounded-xl flex items-center justify-between mt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-pink-600/20 text-pink-400 rounded-lg">
                        <Instagram className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-100">
                          Instagram Business Account
                        </h4>
                        <p className="text-xs font-semibold text-pink-400">
                          @{config.selectedInstagramUsername}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] bg-pink-500/10 text-pink-300 border border-pink-500/30 px-2.5 py-1 rounded-full">
                      {tr('مرتبط عبر الصفحة', 'Lié via la page')}
                    </span>
                  </div>
                )}
              </div>

              {/* Meta Commerce Catalogs */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">
                        {tr('كتالوج منتجات Meta (Commerce Catalog)', 'Catalogue de Produits Meta')}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {tr('الكتالوج هو المجمّع الذي سينقل إليه Business Market قائمة المنتجات.', 'Le catalogue reçoit tous les produits synchronisés.')}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setCatalogModalBusinessId(config.selectedBusinessId || (fetchedBusinesses[0]?.id || ''));
                      setCatalogErrorDetails(null);
                      setShowNewCatalogModal(true);
                    }}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {tr('كتالوج جديد', 'Nouveau')}
                  </button>
                </div>

                {fetchedBusinesses.length > 0 && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-400">
                      {tr('Meta Business Manager', 'Meta Business Manager')}
                    </label>
                    <select
                      value={config.selectedBusinessId}
                      onChange={(e) => handleSelectBusiness(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- {tr('اختر Business Manager', 'Sélectionner Business Manager')} --</option>
                      {fetchedBusinesses.map(b => (
                        <option key={b.id} value={b.id}>{b.name} (ID: {b.id})</option>
                      ))}
                    </select>
                  </div>
                )}

                {fetchedCatalogs.length === 0 ? (
                  <div className="text-center py-6 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">
                      {tr('لا يوجد كتالوج حالي في هذا الحساب. اضغط "كتالوج جديد" لإنشائه.', 'Aucun catalogue trouvé. Cliquez sur "Nouveau" pour en créer un.')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fetchedCatalogs.map((cat) => {
                      const isSelected = config.selectedCatalogId === cat.id;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => handleSelectCatalog(cat.id)}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">
                              <ShoppingBag className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-100">{cat.name}</h4>
                              <p className="text-[11px] text-slate-400">Catalog ID: {cat.id}</p>
                            </div>
                          </div>

                          {isSelected ? (
                            <span className="p-1.5 bg-emerald-500 text-white rounded-full">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 hover:text-slate-200">
                              {tr('تحديد', 'Sélectionner')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PRODUCT SYNCHRONIZATION */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl">
                <PackageIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400">{tr('إجمالي المنتجات المتاحة', 'Produits au catalogue')}</p>
                <p className="text-2xl font-bold text-slate-100">{products.length}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400">{tr('حالة المزامنة التلقائية', 'Mise à jour automatique')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => handleToggleAutoSync(!config.autoSyncEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.autoSyncEnabled ? 'bg-emerald-600' : 'bg-slate-800'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.autoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                  <span className="text-xs font-semibold text-slate-200">
                    {config.autoSyncEnabled ? tr('مفعلة', 'Activée') : tr('معطلة', 'Désactivée')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-purple-600/20 text-purple-400 rounded-xl">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400">{tr('الكتالوج المستهدف', 'Catalogue Cible')}</p>
                <p className="text-xs font-bold text-slate-100 truncate max-w-[180px]">
                  {config.selectedCatalogName || tr('غير محدد', 'Non défini')}
                </p>
              </div>
            </div>
          </div>

          {/* Sync Trigger & Field Mapping Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  {tr('معاينة مطابقة حقول البيانات (Product Field Mapping)', 'Mappage des Champs Produit')}
                </h3>
                <p className="text-xs text-slate-400">
                  {tr('سيتم تحويل هذه البيانات وتصديرها بصيغة Meta Commerce Catalog API القياسية.', 'Aperçu du format transmis à Meta Commerce API.')}
                </p>
              </div>

              <button
                onClick={handleTriggerSyncNow}
                disabled={isSyncing || !isConnected || !config.selectedCatalogId}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {tr('بدء المزامنة الفورية الآن', 'Démarrer la synchronisation')}
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-xs text-slate-300">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th className="py-3 px-4 text-start">{tr('المنتج', 'Produit')}</th>
                    <th className="py-3 px-4 text-start">SKU / ID</th>
                    <th className="py-3 px-4 text-start">{tr('السعر', 'Prix')}</th>
                    <th className="py-3 px-4 text-start">{tr('حالة التوفر', 'Disponibilité')}</th>
                    <th className="py-3 px-4 text-start">{tr('الصورة الرئيسية', 'Image')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {products.slice(0, 10).map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 px-4 font-semibold text-slate-100">{p.name_ar || p.name_fr}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{p.sku || p.id.substring(0, 8)}</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">{p.price} DZD</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          in stock
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <img
                          src={p.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'}
                          alt={p.name_ar}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-700"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length > 10 && (
                <div className="p-3 bg-slate-950 text-center text-xs text-slate-400">
                  {tr(`و ${products.length - 10} منتج آخر جاهز للمزامنة...`, `Et ${products.length - 10} autres produits prêts pour la synchronisation...`)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYNC LOGS & ERRORS */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {tr('سجلات المزامنة والأخطاء', 'Historique des synchronisations')}
              </h3>
              <p className="text-xs text-slate-400">
                {tr('يعرض التواريخ والنتائج واستجابات Meta Graph API السابقة.', 'Journal d\'exécution et logs d\'erreurs Meta API.')}
              </p>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs">{tr('لا توجد سجلات مزامنة حتى الآن.', 'Aucun historique de synchronisation.')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const isSuccess = log.status === 'success';
                return (
                  <div
                    key={log.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isSuccess
                        ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        : 'bg-rose-950/20 border-rose-900/40 hover:border-rose-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {isSuccess ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-slate-100">{log.message}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(log.timestamp).toLocaleString(lang === 'ar' ? 'ar-EG' : 'fr-FR')} • {log.mode === 'auto' ? 'تلقائي' : 'يدوي'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-300">
                          {log.successCount} / {log.totalProducts} {tr('منتج', 'produits')}
                        </span>

                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-xs text-blue-400 hover:underline cursor-pointer"
                        >
                          {tr('التفاصيل', 'Détails')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* NEW CATALOG MODAL */}
      {showNewCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">
                {tr('إنشاء كتالوج منتجات جديد في Meta', 'Créer un nouveau catalogue Meta')}
              </h3>
              <button
                onClick={() => {
                  setShowNewCatalogModal(false);
                  setCatalogErrorDetails(null);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Diagnostics Banner */}
            {catalogErrorDetails && (
              <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {catalogErrorDetails.code ? `Meta API Error (${catalogErrorDetails.code})` : tr('خطأ في استجابة Meta', 'Erreur Meta API')}
                  </span>
                </div>
                <p className="text-rose-200 text-xs">
                  {catalogErrorDetails.user_msg || catalogErrorDetails.message || tr('فشل إنشاء الكتالوج', 'Échec de création')}
                </p>

                {catalogErrorDetails.fbtrace_id && (
                  <p className="text-[11px] text-slate-400 font-mono">
                    fbtrace_id: {catalogErrorDetails.fbtrace_id}
                  </p>
                )}

                {/* Helpful Fix Guidance */}
                <div className="pt-2 border-t border-rose-900/60 text-[11px] text-slate-300 space-y-1.5">
                  <p className="font-semibold text-amber-300">
                    {tr('خطوات حل المشكلة الموصى بها:', 'Actions recommandées :')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>
                      <span className="font-medium text-slate-200">Meta Developers:</span> {tr('تأكد من إضافة منتج "Marketing API" لتطبيقك في لوحة مطوري Meta.', 'Assurez-vous d\'ajouter le produit "Marketing API" dans le tableau de bord Meta Developers.')}
                    </li>
                    <li>
                      <span className="font-medium text-slate-200">Business Portfolio:</span> {tr('تأكد أن حساب فيسبوك المتصل يمتلك صلاحية تحكم كامل (Admin / Full Control) في محفظة الأعمال.', 'Vérifiez que votre compte Facebook a les droits d\'administrateur sur le Business Portfolio.')}
                    </li>
                  </ul>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {tr('اسم الكتالوج الجديد', 'Nom du catalogue')}
              </label>
              <input
                type="text"
                value={newCatalogName}
                onChange={(e) => setNewCatalogName(e.target.value)}
                placeholder="Business Market Commerce Catalog"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Target Business Portfolio */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                {tr('محفظة الأعمال المستهدفة (Meta Business Portfolio ID)', 'Business Portfolio ID')}
              </label>
              {fetchedBusinesses.length > 0 ? (
                <select
                  value={catalogModalBusinessId}
                  onChange={(e) => setCatalogModalBusinessId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- {tr('تحديد محفظة الأعمال', 'Sélectionner le Business')} --</option>
                  {fetchedBusinesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={catalogModalBusinessId}
                  onChange={(e) => setCatalogModalBusinessId(e.target.value)}
                  placeholder={tr('أدخل Business ID أو اتركه فارغاً للاكتشاف التلقائي', 'Business Portfolio ID')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                />
              )}
              <p className="text-[11px] text-slate-400">
                {tr('كتالوجات المنتجات تتطلب دائماً Business Portfolio في Meta ليملك الكتالوج.', 'Les catalogues nécessitent un Business Portfolio dans Meta.')}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewCatalogModal(false);
                  setCatalogErrorDetails(null);
                }}
                className="px-4 py-2 text-xs text-slate-300 bg-slate-800 rounded-xl hover:bg-slate-700"
              >
                {tr('إلغاء', 'Annuler')}
              </button>
              <button
                type="button"
                onClick={handleCreateCatalog}
                disabled={creatingCatalog || !newCatalogName.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {creatingCatalog && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {creatingCatalog ? tr('جاري الإنشاء...', 'Création...') : tr('إنشاء الآن', 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG DETAILS MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">
                {tr('تفاصيل سجّل المزامنة', 'Détails du Log')}
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <p><span className="text-slate-400">ID:</span> {selectedLog.id}</p>
              <p><span className="text-slate-400">{tr('الوقت', 'Horodatage')}:</span> {selectedLog.timestamp}</p>
              <p><span className="text-slate-400">{tr('الحالة', 'Statut')}:</span> <span className={selectedLog.status === 'success' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{selectedLog.status}</span></p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-300 mb-2">Meta API Response payload:</h4>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-300 overflow-x-auto max-h-60 font-mono">
                {JSON.stringify(selectedLog.details || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 text-xs font-semibold rounded-xl"
              >
                {tr('إغلاق', 'Fermer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" x2="12" y1="22" y2="12" />
    </svg>
  );
}
