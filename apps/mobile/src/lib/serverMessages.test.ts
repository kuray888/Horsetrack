import { describe, expect, it } from "vitest";
import { EN } from "@/i18n/en";
import { SERVER_MESSAGES, serverMessage } from "./serverMessages";

describe("messages renvoyés par l'API", () => {
  it("ont tous leur traduction anglaise", () => {
    expect(SERVER_MESSAGES.filter((m) => !(m in EN))).toEqual([]);
  });

  it("restent en français en français, et un message inconnu est gardé", () => {
    expect(serverMessage("Ce code promo a expiré.")).toBe("Ce code promo a expiré.");
    expect(serverMessage("Message inconnu")).toBe("Message inconnu");
  });
});
