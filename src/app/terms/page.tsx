import LegalPage from "@/components/LegalPage";
import { legalDetails } from "@/lib/legal";

export const metadata = { title: "CardHawk AI · Terms of Use" };
export const dynamic = "force-dynamic";

export default function TermsPage() {
  const l = legalDetails();
  const who = `${l.entity}${l.abn ? ` (ABN ${l.abn})` : ""}`;
  return (
    <LegalPage title="Terms of Use">
      <p>
        These terms apply when you use CardHawk AI (&ldquo;CardHawk&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), run by {who}. By creating an
        account or using CardHawk you agree to them. If you don&apos;t agree, please don&apos;t use CardHawk.
      </p>

      <h2>1. What CardHawk does</h2>
      <p>
        CardHawk is a research tool for trading-card buyers. It finds listings on eBay, estimates each card&apos;s market value from
        licensed price guides, and estimates the profit after costs such as fees, shipping, tax and currency exchange. CardHawk does
        not sell, list, hold or ship cards and does not take payment for cards. Every purchase is made on eBay, between you and the
        seller, under eBay&apos;s terms.
      </p>
      <p>
        CardHawk is a member of the eBay Partner Network. If you buy through a &ldquo;View on eBay&rdquo; link, eBay may pay us a
        commission. It doesn&apos;t change the price you pay, and it doesn&apos;t affect which listings CardHawk shows or how it values them.
      </p>

      <h2>2. Estimates, not advice</h2>
      <ul>
        <li>
          Values, profits and returns shown in CardHawk are <strong>estimates</strong>. They depend on third-party price guides, the
          details in each listing, and the costs you set, any of which can be wrong or out of date.
        </li>
        <li>
          CardHawk is <strong>not financial, investment or tax advice</strong>, and it does not recommend that you buy or sell any card.
          You decide what to buy, and you should check the listing, the card, its condition or grade, and recent sales yourself first.
        </li>
        <li>We don&apos;t promise any profit. Card prices go down as well as up, and a card may sell for less than its estimated value.</li>
        <li>
          Grading certificate checks (for example PSA) confirm what the grading company&apos;s records say about a certificate number.
          They don&apos;t prove a slab or card is genuine.
        </li>
      </ul>

      <h2>3. Your account</h2>
      <ul>
        <li>CardHawk is currently invite-only. You must be 18 or older to use it.</li>
        <li>Your account is for you alone. Keep your password private and tell us if you think someone else has used your account.</li>
        <li>You&apos;re responsible for the settings, searches and values you enter.</li>
      </ul>

      <h2>4. Fair use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>copy, resell, publish or share CardHawk&apos;s price-guide values or listing data outside CardHawk;</li>
        <li>scrape, automate, overload or try to get around CardHawk&apos;s limits or security, or reverse-engineer it;</li>
        <li>share your account, or use CardHawk for anything unlawful or to mislead other people.</li>
      </ul>
      <p>We may suspend or close an account that breaks these terms.</p>

      <h2>5. Other companies&apos; services</h2>
      <p>
        CardHawk uses data and services from other companies, including eBay, SportsCardsPro and PriceCharting (market values), and
        PSA (certificate checks). CardHawk is not owned by, endorsed by or affiliated with them, and their names belong to their owners.
        Their data is provided under licence and may change or stop being available, which can affect what CardHawk shows.
      </p>

      <h2>6. Price</h2>
      <p>
        CardHawk is free during the beta. If we introduce paid plans, we&apos;ll tell you the price and what&apos;s included before you&apos;re
        charged anything, and you can choose not to continue.
      </p>

      <h2>7. Changes and availability</h2>
      <p>
        CardHawk is in beta: features may change, and it may sometimes be unavailable or make mistakes. We may update these terms; if
        a change is significant we&apos;ll let you know in the app or by email before it takes effect.
      </p>

      <h2>8. Your consumer rights and our liability</h2>
      <p>
        Nothing in these terms excludes, restricts or changes any right or remedy you have under the Australian Consumer Law or other
        law that can&apos;t be excluded. Subject to that, and to the extent the law allows, we aren&apos;t liable for any loss arising from
        buying or selling cards, or from relying on estimates shown in CardHawk, and where our liability for a failure to meet a
        consumer guarantee can be limited, it is limited to supplying the service again or paying the cost of having it supplied again.
      </p>

      <h2>9. Ending your use</h2>
      <p>
        You can stop using CardHawk at any time and delete your account in Settings → Account, which removes your account and its data
        (see our <a href="/privacy" className="text-accent underline">Privacy Policy</a>).
      </p>

      <h2>10. Law and contact</h2>
      <p>
        These terms are governed by the laws of {l.state}, Australia. Questions or complaints: <strong>{l.email}</strong>.
      </p>
    </LegalPage>
  );
}
