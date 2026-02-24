/**
 * Flyff Universe upgrade system game data.
 * Covers: Weapon/Armor, Jewelry, Armor Piercing, Ultimate Weapon/Jewelry,
 *         Weapon/Shield Piercing Card upgrades.
 *
 * All probability values are "initialChance" — the base success probability
 * on the first attempt.  The pity mechanic then scales it linearly:
 *   successProb(k) = min(k × initialChance, 1.0)
 */

// ============================================================================
// Shared types
// ============================================================================

export type DiceType = "dice4_6" | "dice12";

export interface UpgradeProb {
    level: number;
    initialChance: number;  // 0–1 range
}

export interface LevelCostEntry {
    level: number;
    mineral: number;
    penya: number;
}

export interface UpgradeData {
    diceType: DiceType;
    probabilities: UpgradeProb[];
    costs: LevelCostEntry[];
}

// ============================================================================
// Weapon & Armor Upgrade  (Dice4&6 or Dice12, levels 1–10)
// ============================================================================

export const DICE_4_6_PROBS: UpgradeProb[] = [
    { level: 1,  initialChance: 0.88888889 },
    { level: 2,  initialChance: 0.82352941 },
    { level: 3,  initialChance: 0.75       },
    { level: 4,  initialChance: 0.34736999 },
    { level: 5,  initialChance: 0.20622583 },
    { level: 6,  initialChance: 0.09782638 },
    { level: 7,  initialChance: 0.04562014 },
    { level: 8,  initialChance: 0.01201637 },
    { level: 9,  initialChance: 0.00308911 },
    { level: 10, initialChance: 0.00050293 },
];

export const DICE_12_PROBS: UpgradeProb[] = [
    { level: 1,  initialChance: 1.0        },
    { level: 2,  initialChance: 1.0        },
    { level: 3,  initialChance: 0.86363636 },
    { level: 4,  initialChance: 0.42264973 },
    { level: 5,  initialChance: 0.24440677 },
    { level: 6,  initialChance: 0.11894919 },
    { level: 7,  initialChance: 0.06385147 },
    { level: 8,  initialChance: 0.01773627 },
    { level: 9,  initialChance: 0.00442309 },
    { level: 10, initialChance: 0.00067675 },
];

/** Mineral + Penya base costs per upgrade level step (same for both dice types). */
export const LEVEL_COSTS: LevelCostEntry[] = [
    { level: 1,  mineral: 10,  penya: 2000   },
    { level: 2,  mineral: 14,  penya: 4000   },
    { level: 3,  mineral: 20,  penya: 8000   },
    { level: 4,  mineral: 27,  penya: 15000  },
    { level: 5,  mineral: 38,  penya: 30000  },
    { level: 6,  mineral: 54,  penya: 60000  },
    { level: 7,  mineral: 75,  penya: 75000  },
    { level: 8,  mineral: 105, penya: 125000 },
    { level: 9,  mineral: 148, penya: 250000 },
    { level: 10, mineral: 207, penya: 300000 },
];

// ============================================================================
// Jewelry Upgrade  (Dice8 or Dice10, levels 1–20)
// ============================================================================

export const JEWELRY_DICE8_PROBS: UpgradeProb[] = [
    { level:  1, initialChance: 0.8888888900 },
    { level:  2, initialChance: 0.8235294118 },
    { level:  3, initialChance: 0.4581044440 },
    { level:  4, initialChance: 0.2493069984 },
    { level:  5, initialChance: 0.1418051957 },
    { level:  6, initialChance: 0.0911834609 },
    { level:  7, initialChance: 0.0610808317 },
    { level:  8, initialChance: 0.0409199117 },
    { level:  9, initialChance: 0.0282296525 },
    { level: 10, initialChance: 0.0177362748 },
    { level: 11, initialChance: 0.0120163682 },
    { level: 12, initialChance: 0.0095524157 },
    { level: 13, initialChance: 0.0054401086 },
    { level: 14, initialChance: 0.0038016583 },
    { level: 15, initialChance: 0.0024485555 },
    { level: 16, initialChance: 0.0013861777 },
    { level: 17, initialChance: 0.0006200876 },
    { level: 18, initialChance: 0.0001560417 },
    { level: 19, initialChance: 0.0000766121 },
    { level: 20, initialChance: 0.0000015698 },
];

export const JEWELRY_DICE10_PROBS: UpgradeProb[] = [
    { level:  1, initialChance: 1.0000000000 },
    { level:  2, initialChance: 1.0000000000 },
    { level:  3, initialChance: 0.5569985570 },
    { level:  4, initialChance: 0.2968258491 },
    { level:  5, initialChance: 0.1688875608 },
    { level:  6, initialChance: 0.1088714130 },
    { level:  7, initialChance: 0.0724875434 },
    { level:  8, initialChance: 0.0505493442 },
    { level:  9, initialChance: 0.0322209144 },
    { level: 10, initialChance: 0.0209832282 },
    { level: 11, initialChance: 0.0171175271 },
    { level: 12, initialChance: 0.0136224870 },
    { level: 13, initialChance: 0.0077555964 },
    { level: 14, initialChance: 0.0054401086 },
    { level: 15, initialChance: 0.0035080404 },
    { level: 16, initialChance: 0.0019884101 },
    { level: 17, initialChance: 0.0008906052 },
    { level: 18, initialChance: 0.0002244043 },
    { level: 19, initialChance: 0.0001102193 },
    { level: 20, initialChance: 0.0000022601 },
];

// ============================================================================
// Armor Piercing Upgrade  (Dice8 or Dice10, levels 1–4)
// ============================================================================

export const ARMOR_PIERCING_DICE8_PROBS: UpgradeProb[] = [
    { level: 1, initialChance: 0.75000000   },
    { level: 2, initialChance: 0.3021030303 },
    { level: 3, initialChance: 0.0557040404 },
    { level: 4, initialChance: 0.0038016583 },
];

export const ARMOR_PIERCING_DICE10_PROBS: UpgradeProb[] = [
    { level: 1, initialChance: 0.8636363636 },
    { level: 2, initialChance: 0.3603978509 },
    { level: 3, initialChance: 0.0785111200 },
    { level: 4, initialChance: 0.0054401086 },
];

/** Penya cost per attempt for each armor piercing level. */
export const ARMOR_PIERCING_PENYA: number[] = [
    1_120_000,
    1_400_000,
    1_680_000,
    1_960_000,
];

// ============================================================================
// Ultimate Weapon Upgrade  (XProtect system, levels 1–10)
// ============================================================================

export interface UltimateUpgradeCost {
    level: number;
    mineral: number;   // Sunstone count (same value as mineral shown)
    penya: number;
}

/** Initial success chances — same pity formula as regular upgrades. */
export const ULTIMATE_WEAPON_PROBS: UpgradeProb[] = [
    { level:  1, initialChance: 0.0244824095 },
    { level:  2, initialChance: 0.0177362748 },
    { level:  3, initialChance: 0.0133482050 },
    { level:  4, initialChance: 0.0100237399 },
    { level:  5, initialChance: 0.0073587053 },
    { level:  6, initialChance: 0.0054401086 },
    { level:  7, initialChance: 0.0038016583 },
    { level:  8, initialChance: 0.0019884101 },
    { level:  9, initialChance: 0.0008184658 },
    { level: 10, initialChance: 0.0003050380 },
];

export const ULTIMATE_WEAPON_COSTS: UltimateUpgradeCost[] = [
    { level:  1, mineral:  50, penya:   20_000 },
    { level:  2, mineral: 100, penya:   40_000 },
    { level:  3, mineral: 150, penya:   80_000 },
    { level:  4, mineral: 200, penya:  150_000 },
    { level:  5, mineral: 250, penya:  300_000 },
    { level:  6, mineral: 300, penya:  500_000 },
    { level:  7, mineral: 350, penya:  750_000 },
    { level:  8, mineral: 400, penya:  900_000 },
    { level:  9, mineral: 450, penya: 1_200_000 },
    { level: 10, mineral: 500, penya: 1_500_000 },
];

// ============================================================================
// Ultimate Jewelry Upgrade  (XProtect system, levels 1–10)
// ============================================================================

export const ULTIMATE_JEWELRY_PROBS: UpgradeProb[] = [
    { level:  1, initialChance: 0.0073587053 },
    { level:  2, initialChance: 0.0054401086 },
    { level:  3, initialChance: 0.0030891066 },
    { level:  4, initialChance: 0.0017758901 },
    { level:  5, initialChance: 0.0009657416 },
    { level:  6, initialChance: 0.0005029272 },
    { level:  7, initialChance: 0.0003050380 },
    { level:  8, initialChance: 0.0001408741 },
    { level:  9, initialChance: 0.0000766121 },
    { level: 10, initialChance: 0.0000391396 },
];

/** Ultimate Jewelry uses only Sunstone + XProtect scroll — no mineral cost. */
export const ULTIMATE_JEWELRY_PENYA: number[] = [
     20_000,
     40_000,
     80_000,
    150_000,
    300_000,
    500_000,
    750_000,
    900_000,
  1_200_000,
  1_500_000,
];

// ============================================================================
// Weapon & Shield Piercing Card Upgrade  (Dice8 or Dice10)
// 1-Handed: 5 levels   |   2-Handed: 10 levels
// ============================================================================

export const PIERCING_DICE8_PROBS: UpgradeProb[] = [
    { level:  1, initialChance: 0.3021030253 },
    { level:  2, initialChance: 0.0847440919 },
    { level:  3, initialChance: 0.0227015537 },
    { level:  4, initialChance: 0.0058936935 },
    { level:  5, initialChance: 0.0015076521 },
    // 2-Handed continues with repeated probabilities per slot
    { level:  6, initialChance: 0.3021030253 },
    { level:  7, initialChance: 0.0847440919 },
    { level:  8, initialChance: 0.0227015537 },
    { level:  9, initialChance: 0.0058936935 },
    { level: 10, initialChance: 0.0015076521 },
];

export const PIERCING_DICE10_PROBS: UpgradeProb[] = [
    { level:  1, initialChance: 0.3603978509 },
    { level:  2, initialChance: 0.1012233924 },
    { level:  3, initialChance: 0.0322209144 },
    { level:  4, initialChance: 0.0084214794 },
    { level:  5, initialChance: 0.0022126466 },
    { level:  6, initialChance: 0.3603978509 },
    { level:  7, initialChance: 0.1012233924 },
    { level:  8, initialChance: 0.0322209144 },
    { level:  9, initialChance: 0.0084214794 },
    { level: 10, initialChance: 0.0022126466 },
];

/** Penya cost per attempt — 1-Handed (indices 0–4), 2-Handed (indices 0–9). */
export const PIERCING_1H_PENYA: number[] = [
    1_120_000,
    1_400_000,
    1_680_000,
    1_960_000,
    2_240_000,
];

export const PIERCING_2H_PENYA: number[] = [
    1_120_000,
    1_400_000,
    1_680_000,
    1_960_000,
    2_240_000,
    2_520_000,
    2_800_000,
    3_080_000,
    3_360_000,
    3_640_000,
];

// ============================================================================
// Legacy helpers (used by UpgradeCalculator for weapon/armor)
// ============================================================================

export function getUpgradeData(diceType: DiceType): UpgradeData {
    return {
        diceType,
        probabilities: diceType === "dice12" ? DICE_12_PROBS : DICE_4_6_PROBS,
        costs: LEVEL_COSTS,
    };
}

/** Returns the success probabilities for each level step in [fromLevel, toLevel). */
export function getProbabilityForLevel(diceType: DiceType, fromLevel: number, toLevel: number): number[] {
    const probs = diceType === "dice12" ? DICE_12_PROBS : DICE_4_6_PROBS;
    return probs.slice(fromLevel - 1, toLevel - 1).map(p => p.initialChance);
}

/** Returns the cost entries for each level step in [fromLevel, toLevel). */
export function getCostsForRange(fromLevel: number, toLevel: number): LevelCostEntry[] {
    return LEVEL_COSTS.filter(c => c.level >= fromLevel && c.level < toLevel);
}

/** Returns all success probabilities for the given dice type. */
export function getAllProbabilities(diceType: DiceType): number[] {
    const probs = diceType === "dice12" ? DICE_12_PROBS : DICE_4_6_PROBS;
    return probs.map(p => p.initialChance);
}
