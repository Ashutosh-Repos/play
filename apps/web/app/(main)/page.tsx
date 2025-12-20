import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  
  return (
    <div className="max-w-2xl w-full text-center space-y-8 mt-20">
      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8">
        <h1 className="text-4xl font-bold text-white mb-4">You're In! 🎉</h1>
        <p className="text-xl text-zinc-400">
          Secure Authentication & Onboarding Complete.
        </p>
      </div>

      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 text-left">
         <h2 className="text-lg font-semibold text-white mb-4 border-b border-zinc-800 pb-2">User Profile</h2>
         <div className="space-y-3">
            <div>
                <label className="text-xs uppercase text-zinc-500 font-bold">Display Name</label>
                <p className="text-white text-lg">{session?.user?.displayName}</p>
            </div>
            <div>
                <label className="text-xs uppercase text-zinc-500 font-bold">Username</label>
                <p className="text-zinc-300 font-mono">@{session?.user?.username}</p>
            </div>
             <div>
                <label className="text-xs uppercase text-zinc-500 font-bold">Email</label>
                <p className="text-zinc-300">{session?.user?.email}</p>
            </div>
            <div>
                <label className="text-xs uppercase text-zinc-500 font-bold">Status</label>
                <span className="inline-block mt-1 px-2 py-1 bg-green-900 text-green-300 text-xs rounded-full font-bold">
                    {session?.user?.status}
                </span>
            </div>
         </div>
      </div>
      
      <p className="text-sm text-zinc-600">
        This application has been cleaned up to focus solely on the Authentication Flow.
      </p>
    </div>
  );
}
