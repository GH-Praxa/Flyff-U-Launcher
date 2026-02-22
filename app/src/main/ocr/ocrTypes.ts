export type OcrKind = "digits" | "line" | "exp" | "lvl" | "charname" | "lauftext" | "enemyName" | "enemyHp";

export type OcrRequest = {
    id: number;
    png_b64: string;
    kind?: OcrKind;
};

export type OcrResponse = {
    id: number;
    ok: boolean;
    raw?: string;
    value?: string | null;
    unit?: string | null;
    error?: string;
};
