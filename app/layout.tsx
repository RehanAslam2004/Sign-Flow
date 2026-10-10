import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SignFlow — Translate Signs. Bridge Conversations.',
  description: 'A dignified Pakistan Sign Language recognition tool connecting signers and conversation partners.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-cyan-100 selection:text-cyan-900">
        {children}
      </body>
    </html>
  );
}
