import { Bell, MessageSquare, RefreshCw, UserCheck } from 'lucide-react';

export const notifIcon = (type) => ({ Assigned: UserCheck, StatusChanged: RefreshCw, Commented: MessageSquare }[type] || Bell);
export const getTheme = () => document.documentElement.getAttribute('data-theme') || 'light';
export const openPalette = () => window.dispatchEvent(new Event('palette:open'));
