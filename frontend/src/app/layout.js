import "./globals.css";

export const metadata = {
  title: "Vaani — Multilingual Voice Bot | Hindi • Telugu • English",
  description:
    "An AI-powered voice assistant that fluently understands and converses in Hindi, Telugu, and English with natural code-mixing. Powered by OpenAI Whisper, GPT-4o-mini, and TTS.",
  keywords: [
    "voice bot",
    "Hindi",
    "Telugu",
    "English",
    "multilingual",
    "AI assistant",
    "speech to text",
    "text to speech",
    "code-mixing",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0e1a" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
