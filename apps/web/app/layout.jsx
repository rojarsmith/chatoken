import "./globals.css";
import "./ladder.css";
import "./assistant.css";

export const metadata = {
  title: "Chatoken Console",
  description: "Build a minimal ChatGPT-like system from scratch, one idea at a time"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
