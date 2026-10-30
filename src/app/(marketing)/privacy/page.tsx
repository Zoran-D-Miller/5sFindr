import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy · 5sFindr",
  description: "How 5sFindr collects, uses and protects your personal information (POPIA).",
};

// Plain-English POPIA notice for the pre-launch waitlist. Keep it in step with
// what the waitlist form collects (src/lib/waitlist.ts) and bump EFFECTIVE_DATE
// whenever the substance changes.
const RESPONSIBLE_PARTY = "Zoran Miller";
const CONTACT_EMAIL = "5sfindr@gmail.com";
const EFFECTIVE_DATE = "30 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-heading font-bold text-white">{title}</h2>
      <div className="space-y-3 text-body text-white/70">{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-pitch">{children}</ul>;
}

function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-pitch underline">
      {CONTACT_EMAIL}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-16 pt-10 sm:max-w-xl">
      <header className="flex items-center justify-center">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          5s<span className="text-pitch">Findr</span>
        </Link>
      </header>

      <div className="mt-10">
        <p className="section-label">Privacy policy</p>
        <h1 className="mt-2 text-title font-black">How we look after your details</h1>
        <p className="mt-2 text-meta text-white/40">Effective {EFFECTIVE_DATE}</p>
      </div>

      <div className="card mt-6 space-y-2 p-5 text-body text-white/70">
        <p className="font-semibold text-white">The short version</p>
        <p>
          We only collect what you type into the waitlist, we use it to set up 5sFindr for you, and we only
          message you on the channels you said yes to. We never sell your details. Ask us any time to see,
          fix or delete them: <Mail />.
        </p>
      </div>

      <div className="mt-10 space-y-10">
        <Section title="Who we are">
          <p>
            5sFindr is run by {RESPONSIBLE_PARTY}, a sole proprietor in Cape Town, South Africa. Under the
            Protection of Personal Information Act (POPIA), {RESPONSIBLE_PARTY} is the{" "}
            <strong className="text-white">responsible party</strong> for your information and also our{" "}
            <strong className="text-white">Information Officer</strong>.
          </p>
          <p>
            For anything privacy-related, email <Mail />.
          </p>
        </Section>

        <Section title="What we collect">
          <p>When you join the waitlist:</p>
          <List>
            <li>your name, email address and South African WhatsApp number</li>
            <li>whether you’re joining as a player, someone who runs a regular game, or a venue</li>
            <li>the areas you usually play in, and which one is home</li>
            <li>when you usually play (if you tell us)</li>
            <li>which consent boxes you ticked, when, and which version of the wording you saw</li>
            <li>
              the referral code from the link you used (so we can credit the friend who invited you) and any
              campaign tag in that link, like “tiktok”. You also get your own referral code, and we count how
              many people join with it.
            </li>
          </List>
          <p>Automatically, when you visit the site:</p>
          <List>
            <li>
              <strong className="text-white">Anonymous visit stats</strong> through Umami. Umami uses no
              cookies and doesn’t identify you: it counts things like which page was viewed, the site you came
              from, your browser and device type, and your country.
            </li>
            <li>
              <strong className="text-white">Anti-spam check.</strong> To stop fake sign-ups we keep a
              scrambled, one-way code made from your IP address (not the address itself) for up to a day.
            </li>
            <li>
              <strong className="text-white">Technical logs.</strong> Our hosting providers keep short-lived
              logs (such as IP address and browser) to keep the site secure and running.
            </li>
          </List>
          <p>
            The waitlist sets no cookies. If you later log in to the app, a login cookie keeps you signed in.
            We don’t use advertising or tracking cookies.
          </p>
        </Section>

        <Section title="Why we use it">
          <List>
            <li>to set up your 5sFindr profile when we launch, so you don’t have to start from scratch</li>
            <li>to show you games in your areas at the times you play</li>
            <li>
              to send you launch news and game invites by email and/or WhatsApp, but only on the channels you
              ticked
            </li>
            <li>to track referrals and founding-member perks</li>
            <li>to see which areas have enough players to launch in first</li>
            <li>to keep the site secure and block spam</li>
          </List>
          <p>We don’t sell, rent or trade your details, and we don’t use them for advertising.</p>
        </Section>

        <Section title="Our legal basis: your consent">
          <p>
            We process your waitlist details because you agreed to it. The form has three separate boxes and
            none are ticked for you:
          </p>
          <List>
            <li>
              <strong className="text-white">Save my details</strong> (needed to join): lets us keep your
              details and set up your profile at launch.
            </li>
            <li>
              <strong className="text-white">Email me</strong> (optional): launch news and game invites by
              email.
            </li>
            <li>
              <strong className="text-white">WhatsApp me</strong> (optional): launch news and game invites on
              WhatsApp.
            </li>
          </List>
          <p>
            You can withdraw any of these at any time. That stops future use but doesn’t undo what was done
            before you withdrew. Anonymous visit stats and security logs rely on our legitimate interest in
            running a safe, working website.
          </p>
        </Section>

        <Section title="Who else handles your information">
          <p>We use a few trusted service providers to run 5sFindr. They process data only on our instructions:</p>
          <List>
            <li>
              <strong className="text-white">Supabase</strong>: our database, where waitlist details are stored
              (servers in Ireland, EU).
            </li>
            <li>
              <strong className="text-white">Vercel</strong>: hosts the website (global network, mainly US and
              EU).
            </li>
            <li>
              <strong className="text-white">Umami</strong>: anonymous visit stats.
            </li>
            <li>
              <strong className="text-white">WhatsApp (Meta)</strong> and{" "}
              <strong className="text-white">Gmail (Google)</strong>: carry the messages we send you and the
              emails you send us.
            </li>
          </List>
          <p>
            <strong className="text-white">Sending data outside South Africa.</strong> These providers store
            data on servers outside South Africa. We only use providers bound by data-protection terms that
            give protection similar to POPIA (for example, the EU’s GDPR), as POPIA allows.
          </p>
          <p>
            Only {RESPONSIBLE_PARTY} has access to the waitlist. We won’t share your details with anyone else
            unless the law requires it.
          </p>
          <p>
            If you join our WhatsApp community, other members can see your name and number. That’s how
            WhatsApp communities work, and it’s separate from the waitlist.
          </p>
        </Section>

        <Section title="How long we keep it">
          <List>
            <li>
              Waitlist details: until 5sFindr launches, plus up to 12 months. If you create an account, your
              details move into your profile. If you don’t, we delete them within 12 months of launch.
            </li>
            <li>If you ask us to delete your details, we do it sooner (see below).</li>
            <li>The anti-spam code: up to one day.</li>
          </List>
        </Section>

        <Section title="How we protect it">
          <p>
            Everything travels over an encrypted connection (HTTPS). The waitlist can only be read by our own
            server, never directly from the website, and admin access is limited to {RESPONSIBLE_PARTY}. If
            there’s ever a breach that affects you, we’ll tell you and the Information Regulator as POPIA
            requires.
          </p>
        </Section>

        <Section title="Your rights">
          <p>Under POPIA you can, free of charge:</p>
          <List>
            <li>ask what information we hold about you and get a copy</li>
            <li>ask us to correct anything that’s wrong or out of date</li>
            <li>ask us to delete your information</li>
            <li>object to us using it, including for marketing, at any time</li>
            <li>withdraw your consent</li>
            <li>complain to the Information Regulator (details below)</li>
          </List>
          <p>
            Email <Mail /> from the address you signed up with. We may ask you to confirm it’s really you. We’ll
            reply within 30 days, usually much sooner.
          </p>
        </Section>

        <Section title="How to stop messages">
          <List>
            <li>
              <strong className="text-white">WhatsApp:</strong> reply <strong className="text-white">STOP</strong>{" "}
              to any message from us.
            </li>
            <li>
              <strong className="text-white">Email:</strong> use the unsubscribe link in any email, or email{" "}
              <Mail />.
            </li>
            <li>
              <strong className="text-white">Delete everything:</strong> email <Mail /> with “delete me”.
            </li>
          </List>
        </Section>

        <Section title="Complaints to the Information Regulator">
          <p>
            Please talk to us first so we can try to fix it. If you’re not happy with our answer, you can
            complain to the Information Regulator (South Africa):
          </p>
          <div className="surface-sunken space-y-1 p-4 text-meta text-white/60">
            <p>
              Complaints:{" "}
              <a href="mailto:POPIAComplaints@inforegulator.org.za" className="break-all underline">
                POPIAComplaints@inforegulator.org.za
              </a>
            </p>
            <p>
              General enquiries:{" "}
              <a href="mailto:enquiries@inforegulator.org.za" className="break-all underline">
                enquiries@inforegulator.org.za
              </a>
            </p>
            <p>Phone: 010 023 5200 · Toll-free: 0800 017 160</p>
            <p>Address: Woodmead North Office Park, 54 Maxwell Drive, Woodmead, Johannesburg, 2191</p>
            <p>
              Website:{" "}
              <a href="https://inforegulator.org.za" target="_blank" rel="noopener noreferrer" className="underline">
                inforegulator.org.za
              </a>
            </p>
          </div>
        </Section>

        <Section title="Under 18?">
          <p>
            5sFindr is meant for people aged 18 and over. If you’re younger, please get a parent or guardian’s
            permission before joining. They can ask us to remove your details at any time.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we change this policy we’ll update this page and the date at the top. If we want to use your
            details in a new way, we’ll ask for your consent first.
          </p>
        </Section>
      </div>

      <div className="pitch-line my-14" />

      <footer className="text-center text-xs text-white/30">
        <Link href="/" className="underline">
          Back to 5sFindr
        </Link>{" "}
        · © {new Date().getFullYear()} 5sFindr · Cape Town, South Africa
      </footer>
    </main>
  );
}
