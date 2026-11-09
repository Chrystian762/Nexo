/* Configuracao do Tailwind (CDN) compartilhada por todas as telas do Nexo.
 * Carregar logo depois de <script src="https://cdn.tailwindcss.com"></script> */
tailwind.config = {
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'] },
            colors: {
                brand: {
                    purple: '#7c3aed',
                    purpleDark: '#6d28d9',
                    purpleLight: '#f3e8ff',
                    darkblue: '#1e1b4b',
                    textMain: '#111827',
                    textMuted: '#6b7280',
                    bg: '#f8fafc',
                    border: '#e2e8f0'
                }
            }
        }
    }
};
