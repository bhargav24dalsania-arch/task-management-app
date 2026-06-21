import "./globals.css";

export const metadata = {
  title: "Task Manager",
  description: "Task management, approval workflow, planning, time tracking, and reporting."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
