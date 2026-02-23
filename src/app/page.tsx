import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Welcome to Tutoring System!</h1>
      <nav>
        <ul>
          <li><Link href="/login">Login</Link></li>
          <li><Link href="/register">Register</Link></li>
          <li><Link href="/sessions">Sessions</Link></li>
        </ul>
      </nav>
    </main>
  );
}
