import './globals.css';

export const metadata = {
  title: 'ATS.ai',
  description: 'ATS.ai — Score resumes against job descriptions using AI-powered analysis with GPT-4o-mini and Gemini fallback.',
  keywords: ['ATS', 'recruitment', 'resume scoring', 'AI', 'applicant tracking system'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head />

      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
