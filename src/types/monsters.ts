// src/types/monsters.ts

export type MonsterRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

/**
 * Монстр в ферме = конкретный монстр игрока (userMonsterId)
 * + базовый тип (monsterId) + данные для UI.
 *
 * ⚠️ count здесь не обязателен для фермы, но может быть полезен для коллекции.
 * Оставил как optional, чтобы не мешал ферме.
 */
export interface FarmMonster {
    userMonsterId: number; // id записи "монстр игрока"
    monsterId: number; // id базового монстра (справочник)

    key: string; // удобный ключ: "duck_yellow" и т.п.
    name: string;
    rarity: MonsterRarity;
    imgUrl: string;

    // для коллекции/инвентаря (в ферме может быть не нужен)
    count?: number;

    // прогресс
    level: number; // 1..5
    xp: number;
    xpNext: number | null; // null = MAX
}

/**
 * Слот фермы (карусель)
 */
export interface FarmSlot {
    slotIndex: number; // 1..N или 0..N-1 (как у тебя на бэке)
    isUnlocked: boolean;
    unlockPrice: number;

    fedCountToday: number; // 0..5
    lastFedAt: string | null; // ISO string

    monster: FarmMonster | null;
}

/**
 * Ответ /monsters/farm
 */
export interface FarmResponse {
    slots: FarmSlot[];
}

/**
 * Ответ /monsters/collection (если есть)
 */
export interface CollectionResponse {
    totalCaught: number; // всего поймано (сумма)
    monsters: FarmMonster[]; // список по типам/по userMonster — как у тебя решено
}

/**
 * (Опционально) тип результата кормления
 * если хочешь типизировать res.json() из /monsters/farm/feed
 */
export interface FeedResponse {
    ok: true;
    slotIndex: number;

    // обновлённые значения (если бэк возвращает)
    fedCountToday?: number;
    levelUp?: boolean;
    newLevel?: number;

    // иногда удобно вернуть обновлённого монстра
    monster?: FarmMonster;

    // если начисляешь награду за кормление
    rewardCoins?: number;
    rewardTokens?: number;
}

/**
 * (Опционально) тип результата unlock
 */
export interface UnlockResponse {
    ok: true;
    slotIndex: number;
    isUnlocked: boolean;
}
