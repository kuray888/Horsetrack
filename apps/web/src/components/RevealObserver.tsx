"use client";

import { useEffect } from "react";

/**
 * Apparitions au scroll : ajoute `.is-visible` aux éléments `[data-reveal]`
 * quand ils entrent à l'écran (cf. globals.css).
 *
 * Le contenu reste visible tant que ce script n'a pas tourné (pas de page
 * vide si le JS est lent ou bloqué) : le masquage ne s'applique qu'une fois
 * `html[data-reveal-ready]` posé, et ce qui est déjà à l'écran à ce moment-là
 * est marqué visible d'emblée, sans clignotement.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const limit = window.innerHeight * 0.92;
    elements.forEach((el) => {
      if (el.getBoundingClientRect().top < limit) el.classList.add("is-visible");
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 }
    );
    elements.forEach((el) => {
      if (!el.classList.contains("is-visible")) observer.observe(el);
    });
    root.setAttribute("data-reveal-ready", "");

    return () => {
      observer.disconnect();
      root.removeAttribute("data-reveal-ready");
    };
  }, []);

  return null;
}
