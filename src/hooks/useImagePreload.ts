import { useState, useEffect, useCallback, useRef } from 'react';

export interface PreloadOptions {
  fallbackUrl?: string;
  enabled?: boolean;
}

export interface PreloadResult {
  isLoaded: boolean;
  hasError: boolean;
  loadedUrls: string[];
  progress: number;
  retry: () => void;
}

/**
 * Utility function to preload a single image and return a Promise.
 * Resolves to the loaded URL, or a fallback URL if loading fails.
 */
export function preloadImage(url: string, fallbackUrl?: string): Promise<string> {
  if (!url) return Promise.resolve(fallbackUrl || '');
  
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      resolve(url);
    };
    
    img.onerror = () => {
      console.warn(`[ImagePreload] Failed to load image: ${url}`);
      resolve(fallbackUrl || url);
    };
    
    img.src = url;
  });
}

/**
 * Utility function to preload multiple images in parallel.
 */
export function preloadImages(urls: string[], fallbackUrl?: string): Promise<string[]> {
  const promises = urls.map((url) => preloadImage(url, fallbackUrl));
  return Promise.all(promises);
}

/**
 * React hook to preload one or more images when a component mounts.
 * Ensures smoother rendering and allows components to track load status
 * or show placeholders/skeletons.
 */
export function useImagePreload(
  urls: string | string[] | undefined | null,
  options: PreloadOptions = {}
): PreloadResult {
  const { fallbackUrl = '', enabled = true } = options;
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [loadedUrls, setLoadedUrls] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [retryTrigger, setRetryTrigger] = useState(0);
  
  const urlsArrayRef = useRef<string[]>([]);
  
  // Normalize input to string array
  if (typeof urls === 'string') {
    urlsArrayRef.current = [urls];
  } else if (Array.isArray(urls)) {
    urlsArrayRef.current = urls.filter((url): url is string => typeof url === 'string' && !!url);
  } else {
    urlsArrayRef.current = [];
  }

  const retry = useCallback(() => {
    setRetryTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoaded(true);
      setLoadedUrls(urlsArrayRef.current);
      setProgress(100);
      return;
    }

    const currentUrls = urlsArrayRef.current;
    if (currentUrls.length === 0) {
      setIsLoaded(true);
      setLoadedUrls([]);
      setProgress(100);
      return;
    }

    setIsLoaded(false);
    setHasError(false);
    setProgress(0);

    let completed = 0;
    const total = currentUrls.length;
    const results: string[] = new Array(total);
    let anyError = false;
    let isCancelled = false;

    const loaders = currentUrls.map((url, index) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        
        img.onload = () => {
          if (isCancelled) return;
          results[index] = url;
          completed++;
          setProgress(Math.round((completed / total) * 100));
          resolve();
        };
        
        img.onerror = () => {
          if (isCancelled) return;
          console.warn(`[useImagePreload] Failed to load: ${url}`);
          results[index] = fallbackUrl || url;
          anyError = true;
          completed++;
          setProgress(Math.round((completed / total) * 100));
          resolve();
        };
        
        img.src = url;
      });
    });

    Promise.all(loaders).then(() => {
      if (isCancelled) return;
      setLoadedUrls(results);
      setHasError(anyError);
      setIsLoaded(true);
    });

    return () => {
      isCancelled = true;
    };
  }, [retryTrigger, enabled, fallbackUrl]);

  return {
    isLoaded,
    hasError,
    loadedUrls,
    progress,
    retry,
  };
}
