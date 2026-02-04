// src/types/monsters.ts

export type MonsterRarity =
    | 'COMMON'
    | 'RARE'
    | 'EPIC'
    | 'LEGENDARY';

export interface FarmMonster {
    userMonsterId: number;
    monsterId: number;

    key: string;
    name: string;
    rarity: MonsterRarity;
    imgUrl: string;

    count: number;

    level: number;
    xp: number;
    xpNext: number | null;
}

export interface FarmSlot {
    slotIndex: number;
    isUnlocked: boolean;
    unlockPrice: number;

    fedCountToday: number;
    lastFedAt: string | null;

    monster: FarmMonster | null;
}

export interface FarmResponse {
    slots: FarmSlot[];
}

export interface CollectionResponse {
    totalCaught: number;
    monsters: FarmMonster[];
}
