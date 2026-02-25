import { useMemo } from 'react'
import './BottomNav.css'

import ShopIcon from './assets/icons/shop.svg?react'
import MonsterIcon from './assets/icons/farm.svg?react' // можешь заменить на monster.svg
import FriendsIcon from './assets/icons/friends.svg?react'
import TournamentIcon from './assets/icons/tournaments.svg?react'
import QuestsIcon from './assets/icons/tasks.svg?react'

export type NavKey = 'shop' | 'quests' | 'farm' | 'monster' | 'friends' | 'tournaments'

interface Props {
    active: NavKey
    eggsBadge?: number
    questsDot?: boolean
    onShop: () => void
    onQuests: () => void
    onMonster: () => void
    onFriends: () => void
    onTournaments: () => void
}

function tapLight() {
    const tg = (window as any).Telegram?.WebApp
    tg?.HapticFeedback?.impactOccurred?.('light')
}

function tapSoft() {
    const tg = (window as any).Telegram?.WebApp
    tg?.HapticFeedback?.selectionChanged?.()
}

export function BottomNav({
                              active,
                              eggsBadge,
                              questsDot,
                              onShop,
                              onQuests,
                              onMonster,
                              onFriends,
                              onTournaments,
                          }: Props) {
    const particles = useMemo(() => Array.from({ length: 10 }, (_, i) => i), [])

    return (
        <nav className="bottomnav" role="navigation" aria-label="Bottom navigation">
            {/* FX */}
            <div className="bn-fx" aria-hidden="true">
                <div className="bn-glass" />
                <div className="bn-scanline" />
                <div className="bn-noise" />
                <div className="bn-particles">
                    {particles.map((i) => (
                        <span key={i} className={`bn-p bn-p-${i + 1}`} />
                    ))}
                </div>
            </div>

            <div className="bottomnav-inner">
                {/* РЫНОК */}
                <button
                    data-key="shop"
                    className={`bn-item ${active === 'shop' ? 'is-active' : ''}`}
                    onClick={() => {
                        tapSoft()
                        onShop()
                    }}
                    type="button"
                >
                    <div className="bn-ico">
                        <ShopIcon className="bn-svg" />
                    </div>
                    <div className="bn-txt">Рынок</div>
                </button>

                {/* ЗАДАНИЯ */}
                <button
                    data-key="quests"
                    className={`bn-item ${active === 'quests' ? 'is-active' : ''}`}
                    onClick={() => {
                        tapSoft()
                        onQuests()
                    }}
                    type="button"
                >
                    <div className="bn-ico bn-ico--eggs">
                        <QuestsIcon className="bn-svg" />
                        {questsDot && <span className="bn-dot" />}
                        {!!eggsBadge && (
                            <span className="bn-badge">{eggsBadge > 99 ? '99+' : eggsBadge}</span>
                        )}
                    </div>
                    <div className="bn-txt">Задания</div>
                </button>

                {/* 🔥 MONSTER CENTER */}
                <button
                    data-key="monster"
                    className={`bn-center ${active === 'monster' ? 'is-active' : ''}`}
                    onClick={() => {
                        tapLight()
                        onMonster()
                    }}
                    type="button"
                >
                    <span className="bn-center-ring" aria-hidden="true" />
                    <MonsterIcon className="bn-center-svg" />
                    <div className="bn-center-txt">MONSTER</div>
                </button>

                {/* ДРУЗЬЯ */}
                <button
                    data-key="friends"
                    className={`bn-item ${active === 'friends' ? 'is-active' : ''}`}
                    onClick={() => {
                        tapSoft()
                        onFriends()
                    }}
                    type="button"
                >
                    <div className="bn-ico">
                        <FriendsIcon className="bn-svg" />
                    </div>
                    <div className="bn-txt">Друзья</div>
                </button>

                {/* ТУРНИРЫ */}
                <button
                    data-key="tournaments"
                    className={`bn-item ${active === 'tournaments' ? 'is-active' : ''}`}
                    onClick={() => {
                        tapSoft()
                        onTournaments()
                    }}
                    type="button"
                >
                    <div className="bn-ico">
                        <TournamentIcon className="bn-svg" />
                    </div>
                    <div className="bn-txt">Турниры</div>
                </button>
            </div>
        </nav>
    )
}