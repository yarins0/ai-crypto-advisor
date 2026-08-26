const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-3 p-8">
      <h1 className="text-2xl font-semibold">AI Crypto Advisor</h1>
      <p className="text-slate-400">Scaffold is up. API base: {apiUrl}</p>
    </main>
  );
}
