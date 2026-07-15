import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card-3d w-full max-w-md rounded-2xl border border-[#1a1a1a] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/10">
          <AlertCircle className="h-6 w-6 text-yellow-400" />
        </div>
        <h1 className="text-2xl font-semibold text-white">Page not found</h1>
        <p className="mt-2 text-sm text-neutral-400">
          That route isn’t in the analytics app yet.
        </p>
        <Link
          href="/"
          className="btn-3d mt-6 inline-flex rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
