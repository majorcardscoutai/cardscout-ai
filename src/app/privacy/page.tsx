import LegalPage from "@/components/LegalPage";
import { legalDetails } from "@/lib/legal";

export const metadata = { title: "CardHawk AI · Privacy Policy" };
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const l = legalDetails();
  const who = `${l.entity}${l.abn ? ` (ABN ${l.abn})` : ""}`;
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what personal information CardHawk AI collects, why, and how you can access or delete it. CardHawk is run by{" "}
        {who}. We handle personal information in line with the Australian Privacy Principles.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> your email address and password. Passwords are stored by our sign-in provider in a protected (hashed) form; we never see them.</li>
        <li><strong>What you set up:</strong> your settings (for example fees, costs and where you buy from, including country and optional postcode for shipping quotes), saved searches, Profit Hunter rules, watchlist, portfolio and your own card values.</li>
        <li><strong>Alerts:</strong> the listings found for you, and, if you turn on phone notifications, a technical address for each device your browser gives us.</li>
        <li><strong>Waitlist:</strong> if you join it, your email, where you&apos;re based, your goals and what you collect.</li>
        <li><strong>Usage records:</strong> when you were last active and how many requests your account made to eBay and the price guides (to keep the service within its limits).</li>
      </ul>
      <p>We don&apos;t use advertising or analytics trackers. The only cookies are the ones that keep you signed in.</p>

      <h2>How we use it</h2>
      <ul>
        <li>to run CardHawk for you: searches, values, profit estimates, alerts and your account;</li>
        <li>to send emails you&apos;d expect: invites, password resets and deal alerts you set up;</li>
        <li>to keep CardHawk secure, fix problems and plan its capacity.</li>
      </ul>
      <p>We don&apos;t sell your personal information or share it for advertising.</p>

      <h2>Who helps us run CardHawk</h2>
      <p>
        We use service providers to host and run CardHawk. They may store or process information outside Australia, including in the
        United States:
      </p>
      <ul>
        <li><strong>Supabase</strong> — database and sign-in;</li>
        <li><strong>Vercel</strong> — hosting;</li>
        <li><strong>Resend</strong> — sending emails;</li>
        <li><strong>your browser&apos;s notification service</strong> (for example Apple, Google or Mozilla) — delivering phone notifications.</li>
      </ul>
      <p>
        When CardHawk looks things up for you, it sends search words and card details to <strong>eBay</strong>, <strong>SportsCardsPro</strong> /{" "}
        <strong>PriceCharting</strong> and, for certificate checks, <strong>PSA</strong> — but not your name or email address.
      </p>

      <h2>How long we keep it, and deleting it</h2>
      <ul>
        <li>We keep your information while your account is open.</li>
        <li>You can delete your account in Settings → Account. That permanently removes your account and everything in it.</li>
        <li>To be removed from the waitlist, or for anything else, email us (below).</li>
      </ul>

      <h2>Access, correction and complaints</h2>
      <p>
        You can ask for a copy of the personal information we hold about you, or ask us to correct it, by emailing{" "}
        <strong>{l.email}</strong>. If you have a privacy complaint, contact us first and we&apos;ll respond within 30 days. If you&apos;re not
        satisfied, you can contact the Office of the Australian Information Commissioner (oaic.gov.au).
      </p>

      <h2>Security</h2>
      <p>
        Your data is kept separate from other accounts, both in CardHawk and by the database itself, and sent over encrypted connections.
        No system is perfectly secure; if a data breach is likely to cause you serious harm, we&apos;ll tell you and, where required, the OAIC.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy in a significant way, we&apos;ll let you know in the app or by email.</p>
    </LegalPage>
  );
}
