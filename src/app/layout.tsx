import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Untire Coach',
  description: 'AI coaching support for cancer-related fatigue',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
