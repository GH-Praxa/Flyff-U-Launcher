import { describe, it, expect, beforeEach } from "vitest";
import { UpgradeCalculator } from "../../../src/tools/upgradeCalculator.js";
import { LevelCosts } from "../../../src/tools/upgradeCalculator.js";
import {
  getUpgradeData,
  getProbabilityForLevel,
  getCostsForRange,
  getAllProbabilities,
  DICE_4_6_PROBS,
  DICE_12_PROBS,
  LEVEL_COSTS,
} from "../../../src/tools/upgradeData.js";

describe("UpgradeCalculator", () => {
  let calculator: UpgradeCalculator;

  beforeEach(() => {
    calculator = new UpgradeCalculator();

    const costs: LevelCosts[] = [
      { level: 1, mineral: 1, eron: 1, penya: 100 },
      { level: 2, mineral: 2, eron: 2, penya: 200 },
      { level: 3, mineral: 3, eron: 3, penya: 300 },
      { level: 4, mineral: 4, eron: 4, penya: 400 },
      { level: 5, mineral: 5, eron: 5, penya: 500 },
      { level: 6, mineral: 6, eron: 6, penya: 600 },
      { level: 7, mineral: 7, eron: 7, penya: 700 },
      { level: 8, mineral: 8, eron: 8, penya: 800 },
      { level: 9, mineral: 9, eron: 9, penya: 900 },
      { level: 10, mineral: 10, eron: 10, penya: 1000 },
    ];

    calculator.setLevelCosts(costs);
  });

  describe("calculateExpectedAttemptsSProtect", () => {
    it("sollte korrekte erwartete Versuche berechnen (50% Chance)", () => {
      const result = calculator.calculateExpectedAttemptsSProtect(0.5);
      expect(result).toBeCloseTo(1.5, 6);
    });

    it("sollte korrekte erwartete Versuche berechnen (100% Chance)", () => {
      const result = calculator.calculateExpectedAttemptsSProtect(1.0);
      expect(result).toBeCloseTo(1.0, 6);
    });

    it("sollte korrekte erwartete Versuche berechnen (33.3% Chance)", () => {
      const result = calculator.calculateExpectedAttemptsSProtect(1 / 3);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(4);
    });

    it("sollte fehlschlagen bei ungültigen Wahrscheinlichkeiten", () => {
      expect(() => calculator.calculateExpectedAttemptsSProtect(0)).toThrow();
      expect(() => calculator.calculateExpectedAttemptsSProtect(-1)).toThrow();
      expect(() => calculator.calculateExpectedAttemptsSProtect(2)).toThrow();
    });

    it("sollte numerisch stabil bei kleinen Wahrscheinlichkeiten sein", () => {
      const result = calculator.calculateExpectedAttemptsSProtect(0.01);
      expect(result).toBeGreaterThan(0);
      expect(Number.isFinite(result)).toBe(true);
    });
  });

  describe("calculateSProtect", () => {
    it("sollte Kosten für einen Level berechnen", () => {
      const result = calculator.calculateSProtect(1, 2, [0.5]);

      expect(result.system).toBe("sProtect");
      expect(result.fromLevel).toBe(1);
      expect(result.toLevel).toBe(2);
      expect(result.levelResults).toHaveLength(1);
      expect(result.levelResults[0].expectedAttempts).toBeCloseTo(1.5, 6);
    });

    it("sollte Kosten für mehrere Levels berechnen", () => {
      const probs = [0.5, 0.5, 0.5];
      const result = calculator.calculateSProtect(1, 4, probs);

      expect(result.levelResults).toHaveLength(3);
      expect(result.total.expectedAttempts).toBeCloseTo(4.5, 6);
      expect(result.total.costs.mineral).toBeCloseTo(9, 6);
      expect(result.total.costs.penya).toBeCloseTo(900, 6);
    });

    it("sollte fehlschlagen bei ungültigem Level-Bereich", () => {
      expect(() => calculator.calculateSProtect(5, 3, [0.5])).toThrow();
    });

    it("sollte fehlschlagen bei falscher Anzahl Wahrscheinlichkeiten", () => {
      expect(() => calculator.calculateSProtect(1, 4, [0.5, 0.5])).toThrow();
    });
  });

  describe("calculateSProtectLow - Fixed Markov Chain", () => {
    it("sollte Kosten für Level 1 ohne Downgrade berechnen", () => {
      const result = calculator.calculateSProtectLow(1, 2, [0.5]);

      expect(result.system).toBe("sProtectLow");
      expect(result.levelResults).toHaveLength(1);
      expect(result.levelResults[0].expectedAttempts).toBeCloseTo(2, 6);
    });

    it("sollte Kosten für höhere Levels mit Downgrade berechnen", () => {
      const result = calculator.calculateSProtectLow(1, 3, [0.5, 0.5]);

      expect(result.levelResults).toHaveLength(2);
      expect(result.levelResults[0].expectedAttempts).toBeCloseTo(2, 6);
      expect(result.levelResults[1].expectedAttempts).toBeGreaterThan(2);
    });

    it("sollte korrekte Kosten bei 100% Erfolg berechnen", () => {
      const result = calculator.calculateSProtectLow(1, 3, [1.0, 1.0]);

      expect(result.levelResults[0].expectedAttempts).toBeCloseTo(1, 6);
      expect(result.levelResults[1].expectedAttempts).toBeCloseTo(1, 6);
      expect(result.total.costs.penya).toBeCloseTo(300, 6);
    });

    it("sollte unterschiedliche Wahrscheinlichkeiten pro Level korrekt verarbeiten", () => {
      const result = calculator.calculateSProtectLow(1, 3, [0.5, 0.25]);

      expect(result.levelResults).toHaveLength(2);
      expect(result.levelResults[0].expectedAttempts).toBeCloseTo(2, 6);
      expect(result.levelResults[1].expectedAttempts).toBeGreaterThan(
        result.levelResults[0].expectedAttempts
      );
    });
  });

  describe("calculateWithGameData", () => {
    it("sollte mit echten Flyff Daten für Dice 4&6 berechnen", () => {
      const calc = new UpgradeCalculator();
      const result = calc.calculateWithGameData("dice4_6", 1, 3, "sProtect");

      expect(result.system).toBe("sProtect");
      expect(result.fromLevel).toBe(1);
      expect(result.toLevel).toBe(3);
      expect(result.levelResults).toHaveLength(2);
      expect(result.levelResults[0].expectedAttempts).toBeCloseTo(1.11, 2);
    });

    it("sollte mit echten Flyff Daten für Dice 12 berechnen", () => {
      const calc = new UpgradeCalculator();
      const result = calc.calculateWithGameData("dice12", 1, 3, "sProtect");

      expect(result.system).toBe("sProtect");
      expect(result.levelResults).toHaveLength(2);
      expect(result.levelResults[0].expectedAttempts).toBeCloseTo(1, 6);
      expect(result.levelResults[1].expectedAttempts).toBeCloseTo(1, 6);
    });

    it("sollte SProtect Low mit echten Daten berechnen", () => {
      const calc = new UpgradeCalculator();
      const result = calc.calculateWithGameData(
        "dice4_6",
        1,
        3,
        "sProtectLow"
      );

      expect(result.system).toBe("sProtectLow");
      expect(result.levelResults).toHaveLength(2);
    });
  });

  describe("Monte-Carlo Simulationen", () => {
    it("sollte SProtect simulieren", () => {
      const result = calculator.simulateSProtect(1, 3, [0.5, 0.5], 1000);

      expect(result.successRate).toBeGreaterThan(0);
      expect(result.successRate).toBeLessThanOrEqual(1);
      expect(result.mean.penya).toBeGreaterThan(0);
      expect(result.percentiles.p50.penya).toBeGreaterThan(0);
      expect(result.percentiles.p95.penya).toBeGreaterThan(0);
    });

    it("sollte SProtect Low simulieren", () => {
      const result = calculator.simulateSProtectLow(1, 3, [0.5, 0.5], 1000);

      expect(result.successRate).toBeGreaterThan(0);
      expect(result.successRate).toBeLessThanOrEqual(1);
      expect(result.mean.penya).toBeGreaterThan(0);
    });

    it("sollte 100% Erfolg bei SProtect mit hoher Wahrscheinlichkeit haben", () => {
      const result = calculator.simulateSProtect(1, 3, [0.9, 0.9], 100);

      expect(result.successRate).toBeCloseTo(1, 1);
    });

    it("sollte konsistente Ergebnisse bei mehreren Durchläufen liefern", () => {
      const probs = [0.5, 0.5];
      const iterations = 10000;

      const result1 = calculator.simulateSProtect(1, 3, probs, iterations);
      const result2 = calculator.simulateSProtect(1, 3, probs, iterations);

      const tolerance = 0.1;
      expect(
        Math.abs(result1.mean.penya - result2.mean.penya) / result1.mean.penya
      ).toBeLessThan(tolerance);
    });
  });

  describe("findBreakEven", () => {
    it("sollte Break-Even-Level finden", () => {
      const sProtectProbs = Array.from({ length: 10 }, () => 0.03);
      const sProtectLowProbs = Array.from({ length: 10 }, () => 0.5);

      const result = calculator.findBreakEven(
        1,
        11,
        sProtectProbs,
        sProtectLowProbs
      );

      expect(result.sProtectCost.costs.penya).toBeGreaterThan(0);
      expect(result.sProtectLowCost.costs.penya).toBeGreaterThan(0);
    });

    it("sollte tiefe Analyse liefern", () => {
      const sProtectProbs = Array.from({ length: 5 }, () => 0.1);
      const sProtectLowProbs = Array.from({ length: 5 }, () => 0.5);

      const result = calculator.findBreakEven(
        1,
        6,
        sProtectProbs,
        sProtectLowProbs
      );

      expect(result.sProtectCost).toBeDefined();
      expect(result.sProtectLowCost).toBeDefined();
      expect(["sProtect", "sProtectLow", "tie"]).toContain(result.cheaperSystem);
    });
  });

  describe("Numerische Stabilität", () => {
    it("sollte mit extrem kleinen Wahrscheinlichkeiten funktionieren", () => {
      const result = calculator.calculateSProtect(1, 2, [0.001]);

      expect(result.total.expectedAttempts).toBeGreaterThan(0);
      expect(Number.isFinite(result.total.expectedAttempts)).toBe(true);
    });

    it("sollte mit extrem hohen Wahrscheinlichkeiten funktionieren", () => {
      const result = calculator.calculateSProtect(1, 2, [0.99]);

      expect(result.total.expectedAttempts).toBeCloseTo(1.01, 2);
    });
  });

  describe("Edge Cases", () => {
    it("sollte mit Level-Kosten von 0 funktionieren", () => {
      const calc = new UpgradeCalculator();
      calc.setLevelCosts([{ level: 1, mineral: 0, eron: 0, penya: 0 }]);

      const result = calc.calculateSProtect(1, 2, [0.5]);

      expect(result.total.costs.penya).toBeCloseTo(0, 6);
    });

    it("sollte mit sehr hohen Level-Kosten funktionieren", () => {
      const calc = new UpgradeCalculator();
      calc.setLevelCosts([
        { level: 1, mineral: 1000000, eron: 1000000, penya: 999999999 },
      ]);

      const result = calc.calculateSProtect(1, 2, [0.5]);

      expect(result.total.costs.penya).toBeGreaterThan(0);
      expect(Number.isFinite(result.total.costs.penya)).toBe(true);
    });
  });
});

describe("upgradeData", () => {
  describe("getUpgradeData", () => {
    it("sollte Daten für Dice 4&6 zurückgeben", () => {
      const data = getUpgradeData("dice4_6");

      expect(data.diceType).toBe("dice4_6");
      expect(data.probabilities).toHaveLength(10);
      expect(data.costs).toHaveLength(10);
    });

    it("sollte Daten für Dice 12 zurückgeben", () => {
      const data = getUpgradeData("dice12");

      expect(data.diceType).toBe("dice12");
      expect(data.probabilities).toHaveLength(10);
    });

    it("sollte gleiche Kosten für beide Dice-Typen haben", () => {
      const data46 = getUpgradeData("dice4_6");
      const data12 = getUpgradeData("dice12");

      expect(data46.costs).toEqual(data12.costs);
    });
  });

  describe("getProbabilityForLevel", () => {
    it("sollte Wahrscheinlichkeiten für Level-Bereich zurückgeben", () => {
      const probs = getProbabilityForLevel("dice4_6", 1, 4);

      expect(probs).toHaveLength(3);
      expect(probs[0]).toBeCloseTo(0.88888889, 6);
      expect(probs[1]).toBeCloseTo(0.82352941, 6);
      expect(probs[2]).toBeCloseTo(0.75, 6);
    });

    it("sollte 100% für Level 1&2 bei Dice 12 haben", () => {
      const probs = getProbabilityForLevel("dice12", 1, 3);

      expect(probs[0]).toBe(1.0);
      expect(probs[1]).toBe(1.0);
    });
  });

  describe("getCostsForRange", () => {
    it("sollte Kosten für Level-Bereich zurückgeben", () => {
      const costs = getCostsForRange(1, 4);

      expect(costs).toHaveLength(3);
      expect(costs[0].level).toBe(1);
      expect(costs[0].mineral).toBe(10);
      expect(costs[0].penya).toBe(2000);
    });

    it("sollte korrekte Kosten für höhere Levels haben", () => {
      const costs = getCostsForRange(9, 11);

      expect(costs).toHaveLength(2);
      expect(costs[0].level).toBe(9);
      expect(costs[0].mineral).toBe(148);
      expect(costs[0].penya).toBe(250000);
    });
  });

  describe("getAllProbabilities", () => {
    it("sollte alle 10 Wahrscheinlichkeiten zurückgeben", () => {
      const probs46 = getAllProbabilities("dice4_6");
      const probs12 = getAllProbabilities("dice12");

      expect(probs46).toHaveLength(10);
      expect(probs12).toHaveLength(10);
    });
  });

  describe("Game Data Verification", () => {
    it("sollte korrekte Dice 4&6 Werte haben", () => {
      expect(DICE_4_6_PROBS[0].initialChance).toBeCloseTo(0.88888889, 6);
      expect(DICE_4_6_PROBS[9].initialChance).toBeCloseTo(0.00050293, 6);
    });

    it("sollte korrekte Dice 12 Werte haben", () => {
      expect(DICE_12_PROBS[0].initialChance).toBe(1.0);
      expect(DICE_12_PROBS[1].initialChance).toBe(1.0);
      expect(DICE_12_PROBS[9].initialChance).toBeCloseTo(0.00067675, 6);
    });

    it("sollte korrekte Kosten haben", () => {
      expect(LEVEL_COSTS[0].mineral).toBe(10);
      expect(LEVEL_COSTS[0].penya).toBe(2000);
      expect(LEVEL_COSTS[9].mineral).toBe(207);
      expect(LEVEL_COSTS[9].penya).toBe(300000);
    });
  });
});
