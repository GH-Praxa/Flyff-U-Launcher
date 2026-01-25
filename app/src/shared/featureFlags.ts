export type QuestlogFeature = {
    enabled: boolean;
};

export type FeatureFlags = {
    questlog: QuestlogFeature;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
    questlog: { enabled: false },
};
