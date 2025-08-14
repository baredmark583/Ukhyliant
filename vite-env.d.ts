
interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface Window {
    Telegram?: {
        WebApp: {
            initDataUnsafe: {
                user?: {
                    id: number;
                    first_name?: string;
                    last_name?: string;
                    language_code?: string;
                },
                start_param?: string,
            };
            isExpanded: boolean;
            ready: () => void;
            onEvent: (event: 'viewportChanged', callback: () => void) => void;
            offEvent: (event: 'viewportChanged', callback: () => void) => void;
            HapticFeedback: {
                notificationOccurred: (type: 'success' | 'error') => void;
                impactOccurred: (style: 'light') => void;
            };
            openLink: (url: string) => void;
            openTelegramLink: (url: string) => void;
            openInvoice: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void;
        };
    };
}
