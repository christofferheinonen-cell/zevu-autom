import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zevu Ad Workflow",
  description: "Scan a prospect's website, find their Meta ads, identify weaknesses, and generate an improved ad concept.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi">
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <a href="https://zevu.fi" className="nav-logo">Zevu</a>
            <ul className="nav-links">
              <li><a href="#">Palvelut</a></li>
              <li><a href="#">Blogi</a></li>
              <li><a href="#">Miksi Zevu</a></li>
              <li><a href="#" className="active">Ad Workflow</a></li>
            </ul>
            <div className="nav-right">
              <a href="https://zevu.fi" className="btn btn-ghost btn-sm">zevu.fi</a>
              <a href="mailto:hei@zevu.fi" className="btn btn-primary btn-sm">
                Pyydä analyysi →
              </a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
