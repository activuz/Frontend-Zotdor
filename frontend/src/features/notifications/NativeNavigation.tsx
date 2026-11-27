import React from 'react';
import { useNavigate } from 'react-router-dom';
import { inNativeApp } from './native';

declare global {
  interface Window {
    /** Called by the Android app (MainActivity) to open a path without reloading the site. */
    zotdorNavigate?: (path: string) => boolean;
  }
}

/** Lets a notification tap in the app switch the page in place instead of a full reload. */
export const NativeNavigation: React.FC = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    if (!inNativeApp()) return;
    window.zotdorNavigate = (path: string) => {
      if (!path.startsWith('/') || path.startsWith('//')) return false;
      navigate(path);
      return true;
    };
    return () => {
      delete window.zotdorNavigate;
    };
  }, [navigate]);
  return null;
};
