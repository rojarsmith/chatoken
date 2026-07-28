import "./globals.css";

export const metadata = {
  title: "Chatoken Console",
  description: "Minimal Web UI learning console for the Chatoken API"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
