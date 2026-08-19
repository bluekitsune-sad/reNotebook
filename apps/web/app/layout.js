import './globals.css';
import ClientProviders from '../components/ClientProviders.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Synced Notepad',
  description: 'Offline-first notepad with multi-device sync',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
