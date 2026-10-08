"use client";

import { useState } from "react";
import { ScreenshotPlaceholder } from "./screenshot-placeholder";
import styles from "../marketing.module.css";

const modes = [
  {
    title: "Think it through.",
    name: "Chat",
    intro: "A fresh perspective, just a conversation away.",
    description:
      "Ask the question. Untangle a thought. Explore something you’ve always wondered about. Start anywhere, and see where the conversation takes you.",
    label: "Chat workspace",
  },
  {
    title: "Bring it to life.",
    name: "Create",
    intro: "Give your next idea a little room to grow.",
    description:
      "Shape a story, explore a visual direction, or turn rough notes into something worth sharing. Build on your first thought until it feels right.",
    label: "Creative workspace",
  },
  {
    title: "Make it happen.",
    name: "Work",
    intro: "From the big picture to the next small step.",
    description:
      "Bring your files and ideas into the conversation. Work through a project, make sense of the details, and move your next task forward.",
    label: "Work workspace",
  },
  {
    title: "Build what’s next.",
    name: "Code",
    intro: "A thinking partner for your next build.",
    description:
      "Explore an approach, understand a codebase, or work through a tricky problem. Take your next idea from a possibility to something that works.",
    label: "Coding workspace",
  },
];
export function OverviewModes() {
  const [active, setActive] = useState(0);
  const mode = modes[active];
  return (
    <section className={styles.modes} aria-label="Ways to use Clauxen">
      <div className={styles.modeCopy}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Explore Clauxen capabilities"
        >
          {modes.map((item, index) => (
            <button
              key={item.name}
              type="button"
              role="tab"
              id={`mode-tab-${index}`}
              aria-selected={active === index}
              aria-controls={`mode-panel-${index}`}
              tabIndex={active === index ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => {
                let next = index;
                if (event.key === "ArrowRight")
                  next = (index + 1) % modes.length;
                else if (event.key === "ArrowLeft")
                  next = (index + modes.length - 1) % modes.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = modes.length - 1;
                else return;
                event.preventDefault();
                setActive(next);
                document.getElementById(`mode-tab-${next}`)?.focus();
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div
          id={`mode-panel-${active}`}
          role="tabpanel"
          aria-labelledby={`mode-tab-${active}`}
          tabIndex={0}
        >
          <h2>{mode.title}</h2>
          <p className={styles.modeIntro}>{mode.intro}</p>
          <p className={styles.modeDescription}>{mode.description}</p>
          <a href="/" className={styles.textLink}>
            Find your starting point <span aria-hidden="true">↗</span>
          </a>
        </div>
        <span className={styles.modeIndex}>0{active + 1} / 04</span>
      </div>
      <div className={styles.modeScreenshot}>
        <ScreenshotPlaceholder label={mode.label} />
      </div>
    </section>
  );
}
