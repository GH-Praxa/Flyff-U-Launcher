/**
 * Upgrade Cost Calculator — analytical and Monte-Carlo engine.
 *
 * Two upgrade systems:
 *  - SProtect    : pity mechanic — each failed attempt increases success chance.
 *  - SProtectLow : Markov chain — failed upgrade can downgrade the item by one level.
 */

import {
    type DiceType,
    getUpgradeData,
    getProbabilityForLevel,
} from "./upgradeData.js";

// ============================================================================
// Public types
// ============================================================================

export interface LevelCosts {
    level: number;
    mineral: number;
    eron: number;
    penya: number;
}

export interface CostBreakdown {
    mineral: number;
    eron: number;
    penya: number;
    protects: number;
}

export interface LevelResult {
    expectedAttempts: number;
    costs: CostBreakdown;
}

export interface UpgradeResult {
    system: "sProtect" | "sProtectLow";
    fromLevel: number;
    toLevel: number;
    levelResults: LevelResult[];
    total: {
        expectedAttempts: number;
        costs: CostBreakdown;
    };
}

export interface SimCostBreakdown {
    mineral: number;
    eron: number;
    penya: number;
}

export interface SimulationResult {
    successRate: number;
    mean: SimCostBreakdown;
    percentiles: {
        p50: SimCostBreakdown;
        p95: SimCostBreakdown;
    };
}

export interface BreakEvenResult {
    sProtectCost: UpgradeResult["total"];
    sProtectLowCost: UpgradeResult["total"];
    cheaperSystem: "sProtect" | "sProtectLow" | "tie";
}

// ============================================================================
// Calculator
// ============================================================================

export class UpgradeCalculator {
    private levelCosts: Map<number, LevelCosts>;

    constructor() {
        this.levelCosts = new Map();
    }

    setLevelCosts(costs: LevelCosts[]): void {
        this.levelCosts.clear();
        for (const c of costs) {
            this.levelCosts.set(c.level, c);
        }
    }

    private getCost(level: number): LevelCosts {
        const cost = this.levelCosts.get(level);
        if (!cost) throw new Error(`Keine Kosten für Level ${level}`);
        return cost;
    }

    // ── Analytical: SProtect (pity system) ──────────────────────────────────

    /**
     * Expected *additional* attempts to succeed at a single level using SProtect.
     * Pity mechanic: attempt k has success prob = min(k * baseProb, 1).
     * @param alreadyDone Number of failed attempts already made (pity counter). Default 0.
     */
    calculateExpectedAttemptsSProtect(baseProb: number, alreadyDone = 0): number {
        if (baseProb <= 0 || baseProb > 1) {
            throw new Error(`Ungültige Wahrscheinlichkeit: ${baseProb} (muss > 0 und ≤ 1 sein)`);
        }
        if (baseProb >= 1) return 1;
        const maxAttempt = Math.ceil(1 / baseProb);
        if (alreadyDone >= maxAttempt) return 1; // next attempt is guaranteed
        let expectedAttempts = 0;
        let product = 1.0;
        for (let k = alreadyDone + 1; k <= maxAttempt; k++) {
            const successProb = Math.min(k * baseProb, 1.0);
            expectedAttempts += (k - alreadyDone) * product * successProb;
            if (k < maxAttempt) product *= (1 - successProb);
        }
        return expectedAttempts;
    }

    /**
     * @param startLevelAlreadyDone Failed attempts already done at startLevel (pity offset). Default 0.
     */
    calculateSProtect(startLevel: number, endLevel: number, levelProbs: number[], startLevelAlreadyDone = 0): UpgradeResult {
        if (startLevel >= endLevel) throw new Error("startLevel muss kleiner als endLevel sein");
        if (levelProbs.length !== endLevel - startLevel) {
            throw new Error(`Erwartet ${endLevel - startLevel} Wahrscheinlichkeiten, erhalten ${levelProbs.length}`);
        }

        const levelResults: LevelResult[] = [];
        const totalCosts: CostBreakdown = { mineral: 0, eron: 0, penya: 0, protects: 0 };
        let totalAttempts = 0;

        for (let i = 0; i < levelProbs.length; i++) {
            const level = startLevel + i;
            const cost = this.getCost(level);
            const alreadyDone = i === 0 ? startLevelAlreadyDone : 0;
            const expectedAttempts = this.calculateExpectedAttemptsSProtect(levelProbs[i], alreadyDone);
            const levelCost: LevelResult = {
                expectedAttempts,
                costs: {
                    mineral:  expectedAttempts * cost.mineral,
                    eron:     expectedAttempts * cost.eron,
                    penya:    expectedAttempts * cost.penya,
                    protects: expectedAttempts,
                },
            };
            levelResults.push(levelCost);
            totalAttempts       += expectedAttempts;
            totalCosts.mineral  += levelCost.costs.mineral;
            totalCosts.eron     += levelCost.costs.eron;
            totalCosts.penya    += levelCost.costs.penya;
            totalCosts.protects += levelCost.costs.protects;
        }

        return {
            system: "sProtect",
            fromLevel: startLevel,
            toLevel: endLevel,
            levelResults,
            total: { expectedAttempts: totalAttempts, costs: totalCosts },
        };
    }

    // ── Analytical: SProtectLow (Markov chain with downgrade) ───────────────

    /**
     * Expected cost to advance from `targetLevel` to `targetLevel + 1`,
     * where the chain can downgrade back to `startLevel` on failure.
     * Uses memoization across the chain.
     */
    private calcExpectedCostsWithDowngrade(
        targetLevel: number,
        startLevel: number,
        allProbs: number[],
        memo: Map<number, LevelResult>,
    ): LevelResult {
        const probIndex = targetLevel - startLevel;
        const p = allProbs[probIndex];
        const cost = this.getCost(targetLevel);

        // Base case: no downgrade below the starting level → simple geometric
        if (targetLevel === startLevel) {
            const expectedAttempts = 1 / p;
            return {
                expectedAttempts,
                costs: {
                    mineral:  expectedAttempts * cost.mineral,
                    eron:     expectedAttempts * cost.eron,
                    penya:    expectedAttempts * cost.penya,
                    protects: expectedAttempts,
                },
            };
        }

        const cached = memo.get(targetLevel);
        if (cached) return cached;

        const prev = this.calcExpectedCostsWithDowngrade(targetLevel - 1, startLevel, allProbs, memo);
        const expectedAttempts = (1 + (1 - p) * (prev.expectedAttempts + 1)) / p;
        const result: LevelResult = {
            expectedAttempts,
            costs: {
                mineral:  (cost.mineral  + (1 - p) * (cost.mineral  + prev.costs.mineral))  / p,
                eron:     (cost.eron     + (1 - p) * (cost.eron     + prev.costs.eron))     / p,
                penya:    (cost.penya    + (1 - p) * (cost.penya    + prev.costs.penya))    / p,
                protects: expectedAttempts,
            },
        };
        memo.set(targetLevel, result);
        return result;
    }

    calculateSProtectLow(startLevel: number, endLevel: number, levelProbs: number[]): UpgradeResult {
        if (startLevel >= endLevel) throw new Error("startLevel muss kleiner als endLevel sein");
        if (levelProbs.length !== endLevel - startLevel) {
            throw new Error(`Erwartet ${endLevel - startLevel} Wahrscheinlichkeiten, erhalten ${levelProbs.length}`);
        }

        const levelResults: LevelResult[] = [];
        const totalCosts: CostBreakdown = { mineral: 0, eron: 0, penya: 0, protects: 0 };
        let totalAttempts = 0;
        const memo = new Map<number, LevelResult>();

        for (let i = 0; i < levelProbs.length; i++) {
            const levelCost = this.calcExpectedCostsWithDowngrade(
                startLevel + i, startLevel, levelProbs, memo,
            );
            levelResults.push(levelCost);
            totalAttempts       += levelCost.expectedAttempts;
            totalCosts.mineral  += levelCost.costs.mineral;
            totalCosts.eron     += levelCost.costs.eron;
            totalCosts.penya    += levelCost.costs.penya;
            totalCosts.protects += levelCost.costs.protects;
        }

        return {
            system: "sProtectLow",
            fromLevel: startLevel,
            toLevel: endLevel,
            levelResults,
            total: { expectedAttempts: totalAttempts, costs: totalCosts },
        };
    }

    // ── With built-in game data ──────────────────────────────────────────────

    calculateWithGameData(
        diceType: DiceType,
        fromLevel: number,
        toLevel: number,
        system: "sProtect" | "sProtectLow",
    ): UpgradeResult {
        const data = getUpgradeData(diceType);
        // Eron cost equals mineral cost in game data
        this.setLevelCosts(data.costs.map(c => ({
            level:   c.level,
            mineral: c.mineral,
            eron:    c.mineral,
            penya:   c.penya,
        })));
        const probs = getProbabilityForLevel(diceType, fromLevel, toLevel);
        return system === "sProtect"
            ? this.calculateSProtect(fromLevel, toLevel, probs)
            : this.calculateSProtectLow(fromLevel, toLevel, probs);
    }

    // ── Monte-Carlo simulations ──────────────────────────────────────────────

    /**
     * Simulates `iterations` upgrade runs using the SProtect pity system.
     * Returns mean cost and percentiles (p50, p95) across all runs.
     */
    simulateSProtect(
        fromLevel: number,
        toLevel: number,
        probs: number[],
        iterations: number,
    ): SimulationResult {
        const runs: SimCostBreakdown[] = [];

        for (let i = 0; i < iterations; i++) {
            const runCost: SimCostBreakdown = { mineral: 0, eron: 0, penya: 0 };
            for (let j = 0; j < probs.length; j++) {
                const level = fromLevel + j;
                const cost = this.getCost(level);
                let attempts = 0;
                while (true) {
                    attempts++;
                    if (Math.random() < Math.min(attempts * probs[j], 1.0)) break;
                }
                runCost.mineral += attempts * cost.mineral;
                runCost.eron    += attempts * cost.eron;
                runCost.penya   += attempts * cost.penya;
            }
            runs.push(runCost);
        }

        return this.buildSimulationResult(runs, iterations);
    }

    /**
     * Simulates `iterations` upgrade runs using the SProtectLow Markov chain.
     * Failed upgrades can downgrade the item by one level (floor = fromLevel).
     */
    simulateSProtectLow(
        fromLevel: number,
        toLevel: number,
        probs: number[],
        iterations: number,
    ): SimulationResult {
        const runs: SimCostBreakdown[] = [];

        for (let i = 0; i < iterations; i++) {
            const runCost: SimCostBreakdown = { mineral: 0, eron: 0, penya: 0 };
            let currentLevel = fromLevel;

            while (currentLevel < toLevel) {
                const p = probs[currentLevel - fromLevel];
                const cost = this.getCost(currentLevel);
                runCost.mineral += cost.mineral;
                runCost.eron    += cost.eron;
                runCost.penya   += cost.penya;

                if (Math.random() < p) {
                    currentLevel++;
                } else if (currentLevel > fromLevel) {
                    currentLevel--;
                }
                // at floor with fail → stay at floor
            }
            runs.push(runCost);
        }

        return this.buildSimulationResult(runs, iterations);
    }

    private buildSimulationResult(runs: SimCostBreakdown[], iterations: number): SimulationResult {
        const mean: SimCostBreakdown = {
            mineral: runs.reduce((s, r) => s + r.mineral, 0) / iterations,
            eron:    runs.reduce((s, r) => s + r.eron,    0) / iterations,
            penya:   runs.reduce((s, r) => s + r.penya,   0) / iterations,
        };
        const sorted = [...runs].sort((a, b) => a.penya - b.penya);
        return {
            successRate: 1.0,
            mean,
            percentiles: {
                p50: sorted[Math.floor(iterations * 0.50)],
                p95: sorted[Math.floor(iterations * 0.95)],
            },
        };
    }

    // ── Break-even analysis ──────────────────────────────────────────────────

    /**
     * Calculates the total expected costs for both systems over the full level
     * range and determines which is cheaper (by penya).
     */
    findBreakEven(
        fromLevel: number,
        toLevel: number,
        sProtectProbs: number[],
        sProtectLowProbs: number[],
    ): BreakEvenResult {
        const sp  = this.calculateSProtect(fromLevel, toLevel, sProtectProbs);
        const spl = this.calculateSProtectLow(fromLevel, toLevel, sProtectLowProbs);

        const spPenya  = sp.total.costs.penya;
        const splPenya = spl.total.costs.penya;

        const cheaperSystem: "sProtect" | "sProtectLow" | "tie" =
            spPenya  < splPenya ? "sProtect" :
            splPenya < spPenya  ? "sProtectLow" :
            "tie";

        return {
            sProtectCost:    sp.total,
            sProtectLowCost: spl.total,
            cheaperSystem,
        };
    }
}
