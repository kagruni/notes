import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from 'react-hot-toast';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Notes App",
  description: "A modern notes application with projects and authentication",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else if (savedTheme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (systemPrefersDark) {
                    document.documentElement.classList.add('dark');
                  }
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200`}
      >
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#4ade80',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 4000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
              {children}
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
