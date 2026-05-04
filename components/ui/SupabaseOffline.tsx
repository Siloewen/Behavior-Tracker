export default function SupabaseOffline() {
  return (
    <div className="text-center pt-16">
      <h1 className="text-xl font-semibold">Mirror is open.</h1>
      <p className="text-white/40 text-sm mt-2">
        Login is disabled, but the Supabase project URL is not reachable from this machine right now.
      </p>
      <p className="text-white/25 text-xs mt-4">
        Once Supabase resolves again, your tracker data will load here directly.
      </p>
    </div>
  );
}
