import type { CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { STORIES } from "@/content/home";
import styles from "./Stories.module.css";

/** Une fonctionnalité par bloc, texte et capture réelle en alternance. */
export function Stories() {
  return (
    <div className={styles.stories}>
      {STORIES.map((story, index) => {
        const reverse = index % 2 === 1;
        const duo = story.screens.length > 1;
        return (
          <section
            key={story.id}
            id={story.id}
            className={`${styles.story} ${reverse ? styles.reverse : ""}`}
            aria-labelledby={`${story.id}-title`}
          >
            <div className={`container ${styles.grid}`}>
              <div className={styles.copy} data-reveal>
                <p className={`sticker sticker--${story.tone} ${reverse ? "sticker--tilt-right" : ""}`}>{story.eyebrow}</p>
                <h2 id={`${story.id}-title`} className="h2">
                  {story.title[0]} <span className="accent">{story.title[1]}</span>
                </h2>
                <p className="lead">{story.text}</p>
                <ul role="list" className={styles.bullets}>
                  {story.bullets.map((bullet) => (
                    <li key={bullet}>
                      <span className={styles.check}>
                        <Icon name="check" size={14} strokeWidth={3} />
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className={`${styles.visual} ${styles[story.tone]} ${duo ? styles.duo : ""}`}
                data-reveal={reverse ? "left" : "right"}
                style={{ "--reveal-delay": "120ms" } as CSSProperties}
              >
                <span className={styles.backdrop} aria-hidden="true" />
                {story.screens.map((name, i) => (
                  <div key={name} className={`${styles.phone} ${duo ? styles[`duo${i}`] : ""}`}>
                    <Screen name={name} sizes={duo ? "(min-width: 900px) 260px, 46vw" : "(min-width: 900px) 330px, 70vw"} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
