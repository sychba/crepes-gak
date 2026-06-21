import "../src/index.css";
import ConvexClientProvider from "../src/components/ConvexClientProvider";

export const metadata = {
  title: "Crêpes GAK",
  description: "Digitales Bestell- & Treuekarten-System mit Apple Wallet Stempelkarte",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body>
        <ConvexClientProvider>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
