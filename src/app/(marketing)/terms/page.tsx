import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of use · 5sFindr",
  description: "The plain-English rules for using 5sFindr, a free 5-a-side football app in Cape Town.",
};

// Starter terms in plain English, not legal advice. Keep the layout in step
// with /privacy and bump EFFECTIVE_DATE whenever the substance changes.
const OPERATOR = "Zoran Miller";
const CONTACT_EMAIL = "5sfindr@gmail.com";
const EFFECTIVE_DATE = "17 November 2026";

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

function PrivacyLink() {
  return (
    <Link href="/privacy" className="font-semibold text-pitch underline">
      privacy policy
    </Link>
  );
}

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-16 pt-10 sm:max-w-xl">
      <header className="flex items-center justify-center">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          5s<span className="text-pitch">Findr</span>
        </Link>
      </header>

      <div className="mt-10">
        <p className="section-label">Terms of use</p>
        <h1 className="mt-2 text-title font-black">The rules of the game</h1>
        <p className="mt-2 text-meta text-white/40">Effective {EFFECTIVE_DATE}</p>
      </div>

      <div className="card mt-6 space-y-2 p-5 text-body text-white/70">
        <p className="font-semibold text-white">The short version</p>
        <p>
          5sFindr is a free app that helps people in Cape Town find and organise 5-a-side games. Be decent to
          other players, only post real games, and play at your own risk. We look after your details as our{" "}
          <PrivacyLink /> explains. Questions: <Mail />.
        </p>
      </div>

      <div className="mt-10 space-y-10">
        <Section title="Who runs 5sFindr">
          <p>
            5sFindr (the website at 5sfindr.com, the app and our social media accounts) is run by {OPERATOR}, a
            sole proprietor in Cape Town, South Africa. In these terms, “we” and “us” means {OPERATOR}, and
            “you” means anyone who uses 5sFindr.
          </p>
          <p>
            By using 5sFindr, or joining the waitlist, you agree to these terms. If you don’t agree, please
            don’t use it.
          </p>
        </Section>

        <Section title="What 5sFindr is (and isn’t)">
          <p>5sFindr helps players find games, fill spots and keep track of who’s playing. It’s free to use.</p>
          <p>
            We don’t run the games, own or manage the venues, or employ the people who organise matches.
            Games are arranged between players. Any booking or payment for a pitch is between you, the
            organiser and the venue.
          </p>
        </Section>

        <Section title="Playing is at your own risk">
          <p>
            Football is a contact sport and people get hurt. When you join or organise a game through
            5sFindr, you take part at your own risk.
          </p>
          <List>
            <li>Only play if you’re fit and well enough to.</li>
            <li>Check the venue, time and details with the organiser before you go.</li>
            <li>Look after your own belongings, travel and safety.</li>
          </List>
          <p>
            We don’t check players, organisers or venues, and we can’t promise that a game will happen, that
            people will turn up, or how anyone will behave on the day. As far as the law allows, we aren’t
            responsible for injury, loss or damage that happens at, or on the way to or from, a game arranged
            through 5sFindr. Nothing in these terms takes away rights that the law (such as the Consumer
            Protection Act) says can’t be taken away.
          </p>
        </Section>

        <Section title="Using 5sFindr fairly">
          <p>You agree not to:</p>
          <List>
            <li>post fake games, or games you don’t intend to run</li>
            <li>harass, threaten, abuse or discriminate against anyone</li>
            <li>post anything illegal, hateful, sexual, violent or misleading</li>
            <li>pretend to be someone else, or sign other people up without their permission</li>
            <li>use other players’ details for anything except arranging the game they joined</li>
            <li>send spam or advertising through 5sFindr</li>
            <li>try to break, overload or get around the security of 5sFindr, or scrape or copy it with bots</li>
          </List>
          <p>
            You’re responsible for what you post and for keeping your login to yourself. You should be 18 or
            older, or have a parent or guardian’s permission.
          </p>
        </Section>

        <Section title="No guarantee it’s always there">
          <p>
            5sFindr is new and run by one person. We work hard to keep it running, but we provide it “as is”.
            We can’t promise it will always be available or free of errors, or that game details posted by
            players are correct. We may change, pause or stop parts of 5sFindr at any time, and we’ll try to
            give notice when we can.
          </p>
        </Section>

        <Section title="Removing accounts and posts">
          <p>
            We may remove a game, a post or an account, or stop someone from using 5sFindr, if they break
            these terms, put other players at risk, or if the law requires it. Where it makes sense, we’ll tell
            you why.
          </p>
          <p>
            You can stop using 5sFindr whenever you like. To delete your account or your waitlist details,
            email <Mail /> with “delete me” from the address you signed up with.
          </p>
        </Section>

        <Section title="Your personal information">
          <p>
            How we collect, use and protect your details under the Protection of Personal Information Act
            (POPIA) is set out in our <PrivacyLink />.
          </p>
        </Section>

        <Section title="Our name and content">
          <p>
            The 5sFindr name, logo, app and our own posts and videos belong to us. You’re welcome to share
            links to them, but please don’t copy them or pass them off as your own. What you post stays yours;
            you let us show it on 5sFindr so the app can work.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            If we change these terms we’ll update this page and the date at the top. If a change is important,
            we’ll also tell you in the app or on a channel you agreed to hear from us on. If you keep using
            5sFindr after a change, the new terms apply.
          </p>
        </Section>

        <Section title="South African law">
          <p>
            These terms are governed by the law of South Africa, and South African courts deal with any
            dispute. Please talk to us first, though: most things can be sorted out with a quick message.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            For anything about these terms, email <Mail />.
          </p>
        </Section>
      </div>

      <div className="pitch-line my-14" />

      <footer className="text-center text-xs text-white/30">
        <Link href="/" className="underline">
          Back to 5sFindr
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>{" "}
        · © {new Date().getFullYear()} 5sFindr · Cape Town, South Africa
      </footer>
    </main>
  );
}
