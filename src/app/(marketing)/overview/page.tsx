import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { OverviewModes } from "../_components/overview-modes";
import { ScreenshotPlaceholder } from "../_components/screenshot-placeholder";
import styles from "../marketing.module.css";

export const metadata: Metadata = {
  title: "Clauxen — A little curiosity. Endless possibilities.",
  description:
    "A place to think, create, and make things happen. Discover chat, creative tools, connected work, and code with Clauxen.",
  alternates: { canonical: "/overview" },
  openGraph: {
    title: "Meet Clauxen",
    description: "Your ideas, with room to grow.",
    url: "/overview",
    type: "website",
  },
};
export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

const useCases = [
  {
    number: "01",
    name: "Find the right words.",
    description:
      "From a first thought to a final draft. Write, refine, and find a voice that feels like you.",
    label: "Writing preview",
    style: "writing",
  },
  {
    number: "02",
    name: "Make imagination visible.",
    description:
      "Explore a new direction. Turn the picture in your head into something you can share.",
    label: "Image creation preview",
    style: "images",
  },
  {
    number: "03",
    name: "Move work forward.",
    description:
      "Bring your context together. Give your projects a little more clarity, and your day a little more space.",
    label: "Connected work preview",
    style: "work",
  },
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function OverviewPage() {
  return (
    <>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link
          href="/overview"
          className={styles.brand}
          aria-label="Clauxen home"
        >
          <Image
            src="/assets/icons/clauxen-icon.png"
            width={32}
            height={32}
            alt=""
            priority
          />
          <span>Clauxen</span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          <a href="#possibilities">Explore</a>
          <a href="#how-it-works">How it works</a>
          <Link href="/business">For teams</Link>
          <Link href="/plans">Plans</Link>
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.login} href="/login">
            Log in
          </Link>
          <Link className={styles.button} href="/">
            Try Clauxen <Arrow />
          </Link>
        </div>
        <details className={styles.mobileMenu}>
          <summary aria-label="Open navigation">☰</summary>
          <nav aria-label="Mobile navigation">
            <a href="#possibilities">Explore</a>
            <a href="#how-it-works">How it works</a>
            <Link href="/business">For teams</Link>
            <Link href="/plans">Plans</Link>
            <Link href="/login">Log in</Link>
          </nav>
        </details>
      </header>
      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.eyebrow}>
            <span className={styles.blueDot} /> MEET CLAUXEN
          </div>
          <h1 id="hero-title">
            A little curiosity.
            <br />
            <span className={styles.serif}>Endless</span> possibilities
            <span className={styles.bluePeriod}>.</span>
          </h1>
          <p>
            A place to think, create, and make things happen.
            <br className={styles.desktopBreak} /> All your ideas. One brilliant
            starting point.
          </p>
          <div className={styles.heroActions}>
            <Link href="/" className={styles.button}>
              Start something <Arrow />
            </Link>
            <a href="#how-it-works" className={styles.textLink}>
              Get to know Clauxen <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className={styles.heroNote}>
            For the everyday. And the extraordinary.
          </div>
        </section>
        <section
          className={styles.showcase}
          aria-label="Clauxen product preview"
        >
          <div className={styles.orbitArt} aria-hidden="true">
            <div />
            <div />
            <div />
          </div>
          <span className={styles.starArt} aria-hidden="true">
            ✳
          </span>
          <svg
            className={styles.scribbleArt}
            viewBox="0 0 190 130"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 111C44 18 63 9 70 57C78 107 105 18 120 37C135 56 127 95 178 14"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </svg>
          <div className={styles.heroScreenshot}>
            <ScreenshotPlaceholder label="Your Clauxen workspace" />
          </div>
          <div className={styles.previewCaption}>
            <span>ONE SPACE. SO MANY POSSIBILITIES.</span>
            <span>
              Think beyond the blank page <Arrow />
            </span>
          </div>
        </section>
        <section className={styles.intro} id="how-it-works">
          <p className={styles.eyebrow}>A NEW WAY TO GET THERE</p>
          <h2>
            Big idea?
            <br />
            Small question?
            <br />
            <span className={styles.serif}>You’re in the right place.</span>
          </h2>
          <p className={styles.introCopy}>
            Some days you need an answer. Other days, a fresh perspective or a
            hand with the hard part. Clauxen gives your thinking somewhere to
            go.
          </p>
        </section>
        <OverviewModes />
        <section className={styles.possibilities} id="possibilities">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>MAKE IT YOURS</p>
              <h2>
                For whatever
                <br />
                <span className={styles.serif}>comes to mind.</span>
              </h2>
            </div>
            <p>
              Follow an idea. Learn something new.
              <br />
              Make a little progress, every day.
            </p>
          </div>
          <div className={styles.useCaseGrid}>
            {useCases.map((item) => (
              <article key={item.number} className={styles.useCaseCard}>
                <div className={styles.cardTop}>
                  <span>{item.number} /</span>
                  <span aria-hidden="true">↗</span>
                </div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className={`${styles.cardPreview} ${styles[item.style]}`}>
                  <ScreenshotPlaceholder label={item.label} compact />
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className={styles.teamSection}>
          <div className={styles.teamArt} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <div className={styles.artLabel}>BETTER, TOGETHER.</div>
          </div>
          <div className={styles.teamCopy}>
            <p className={styles.eyebrow}>A LITTLE MORE COLLECTIVE</p>
            <h2>
              Great minds.
              <br />
              <span className={styles.serif}>Shared momentum.</span>
            </h2>
            <p>
              Give your team a common place to explore ideas, bring context
              together, and move from “what if” to what’s next.
            </p>
            <Link href="/business" className={styles.textLink}>
              Explore Clauxen for teams <Arrow />
            </Link>
          </div>
        </section>
        <section className={styles.principles} id="your-space">
          <div>
            <p className={styles.eyebrow}>YOUR SPACE TO THINK</p>
            <h2>
              Make room for ideas.
              <br />
              <span className={styles.serif}>Keep control of your space.</span>
            </h2>
          </div>
          <div className={styles.principleGrid}>
            <article>
              <span aria-hidden="true">◎</span>
              <h3>Your preferences. Your way.</h3>
              <p>
                Make Clauxen feel like your own with the settings and
                preferences that work for you.
              </p>
              <Link href="/legal/privacy">
                Read our privacy policy <Arrow />
              </Link>
            </article>
            <article>
              <span aria-hidden="true">⌘</span>
              <h3>A plan for your possibilities.</h3>
              <p>
                Find the right fit for your everyday ideas, ambitious projects,
                or the whole team.
              </p>
              <Link href="/plans">
                Explore plans <Arrow />
              </Link>
            </article>
          </div>
        </section>
        <section className={styles.finalCta}>
          <p className={styles.eyebrow}>THERE’S MORE IN YOU</p>
          <h2>
            Let’s see where
            <br />
            <span className={styles.serif}>your mind goes.</span>
            <span className={styles.bluePeriod}> ✳</span>
          </h2>
          <Link href="/" className={styles.button}>
            Try Clauxen <Arrow />
          </Link>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <Link href="/overview" className={styles.brand}>
            <Image
              src="/assets/icons/clauxen-icon.png"
              width={28}
              height={28}
              alt=""
            />
            <span>Clauxen</span>
          </Link>
          <p>A little curiosity goes a long way.</p>
          <nav aria-label="Footer navigation">
            <Link href="/plans">Plans</Link>
            <Link href="/business">Business</Link>
            <Link href="/download">Download</Link>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} Clauxen</span>
          <div>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/cookies">Cookies</Link>
          </div>
          <span>Made for a curious world. ↗</span>
        </div>
      </footer>
    </>
  );
}
