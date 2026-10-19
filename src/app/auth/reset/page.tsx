import HawkLogo from "@/components/HawkLogo";
import NewPasswordForm from "./NewPasswordForm";

export const metadata = { title: "CardHawk AI · Choose a password" };

/** Where the emailed reset (and, later, invite) links land. */
export default function ResetPage() {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg px-4 py-10">
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center">
        <div className="rounded-2xl border border-line bg-panel p-6">
          <div className="mb-6 flex items-center gap-2.5">
            <HawkLogo framed className="h-12 w-12 shrink-0" />
            <div>
              <div className="font-semibold">Choose a password</div>
              <div className="text-xs text-faint">CardHawk AI</div>
            </div>
          </div>
          <NewPasswordForm />
          <div className="mt-4 text-center text-xs">
            <a href="/login" className="text-accent hover:underline">Back to sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
}
