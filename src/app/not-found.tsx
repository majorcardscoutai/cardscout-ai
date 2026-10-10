import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted">That page or listing doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 inline-block text-sm text-accent hover:underline">
        Back to Overview
      </Link>
    </div>
  );
}
