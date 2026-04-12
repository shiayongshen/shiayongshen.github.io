import { FormEvent, useState } from "react";

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("changeme123");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setError("");
      await onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <section className="panel auth-card">
      <p className="eyebrow">Admin Login</p>
      <h1>Manage your site</h1>
      <form className="stack" onSubmit={handleSubmit}>
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
        />
        <button className="primary-button">Login</button>
        {error ? <p className="error-text">{error}</p> : null}
      </form>
    </section>
  );
}
