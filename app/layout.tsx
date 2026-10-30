import type { Metadata } from "next";
import Link from "next/link";
import { displayName, getCurrentUser } from "@/lib/auth";
import { signOutAction } from "./login/actions";
import "./globals.css";

const appName = process.env.APP_NAME || "Time Tracker";

export const metadata: Metadata = {
  title: appName,
  description: "Track hours against projects",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">{appName}</Link>
            {user && (
              <nav>
                <Link href="/">Log time</Link>
                {user.isAdmin && <Link href="/projects">Projects</Link>}
                <Link href="/reports">Reports</Link>
                <Link href="/profile" className="who" title={user.email}>{displayName(user)}</Link>
                <form action={signOutAction}>
                  <button type="submit" className="link-button">Sign out</button>
                </form>
              </nav>
            )}
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
