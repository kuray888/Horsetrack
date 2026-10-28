import { describe, expect, it } from "vitest";
import { containsMedicalAdvice, mentionsSymptom, vetMessage } from "@/lib/coach/safety";

describe("garde-fou vétérinaire", () => {
  it("repère les symptômes et les demandes de soin, en français et en anglais", () => {
    for (const q of [
      "Il boite de l'antérieur droit depuis hier, je fais quoi ?",
      "Mon cheval a des coliques",
      "Il a de la fièvre, 39,5",
      "Une plaie au boulet, comment la soigner ?",
      "Son tendon est gonflé et chaud",
      "Il tousse le matin",
      "Il ne mange plus depuis ce matin",
      "Combien de bute je peux lui donner ?",
      "Quel anti-inflammatoire pour une tendinite ?",
      "My horse is lame on the left hind",
      "He has colic, what should I do?",
      "There is a swelling on his leg",
      "How do I treat a hoof abscess?",
    ]) {
      expect(mentionsSymptom(q), q).toBe(true);
    }
  });

  it("laisse passer les questions sur le carnet, soins de routine compris", () => {
    for (const q of [
      "C'est quand le prochain vermifuge ?",
      "Combien j'ai dépensé en maréchal cette année ?",
      "Combien de séances ce mois-ci ?",
      "Quand est la prochaine dose de vermifuge ?",
      "Quand a eu lieu le dernier passage du vétérinaire ?",
      "Combien m'a coûté le vétérinaire en 2026 ?",
      "When is the next vaccination due?",
      "How many sessions did we do in October?",
      "Combien pèse mon cheval ?",
    ]) {
      expect(mentionsSymptom(q), q).toBe(false);
    }
  });

  it("refuse une réponse qui parle de médicament ou de diagnostic", () => {
    expect(containsMedicalAdvice("Donne-lui un anti-inflammatoire pendant 3 jours.")).toBe(true);
    expect(containsMedicalAdvice("Il a probablement une tendinite.")).toBe(true);
    expect(containsMedicalAdvice("He probably has an abscess.")).toBe(true);
    expect(containsMedicalAdvice("Le prochain vermifuge est prévu le 12 novembre.")).toBe(false);
    expect(containsMedicalAdvice("Une séance de détente au pas, rênes longues.")).toBe(false);
  });

  it("repère les pluriels et dérivés (pas de \\b final derrière un préfixe)", () => {
    for (const q of [
      "Quels antibiotiques lui donner ?",
      "Des corticoïdes pour sa toux ?",
      "Quels médicaments pour ça ?",
      "Can you diagnose what he has?",
      "Which medications should I give?",
      "Il faut diagnostiquer quoi ?",
    ]) {
      expect(mentionsSymptom(q), q).toBe(true);
    }
    for (const a of ["Donne-lui des antibiotiques.", "The diagnosis is clear.", "Des anti-inflammatoires 3 jours.", "Some medications would help."]) {
      expect(containsMedicalAdvice(a), a).toBe(true);
    }
  });

  it("ne confond pas le boulet (articulation) avec une boule", () => {
    expect(mentionsSymptom("Quand ai-je acheté les protège-boulets ?")).toBe(false);
    expect(mentionsSymptom("Il a une boule sur le canon")).toBe(true);
  });

  it("renvoie vers le vétérinaire dans la langue de l'app", () => {
    expect(vetMessage("fr")).toContain("vétérinaire");
    expect(vetMessage("en")).toContain("vet");
  });
});
