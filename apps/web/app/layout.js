import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
