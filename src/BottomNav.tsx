import { useMemo } from 'react'
import './BottomNav.css'

import ShopIcon from './assets/icons/shop.svg?react'
import FarmIcon from './assets/icons/farm.svg?react'
import FriendsIcon from './assets/icons/friends.svg?react'
import TournamentIcon from './assets/icons/leaders.svg?react'
import QuestsIcon from './assets/icons/tasks.svg?react'

type NavKey = 'shop' | 'quests' | 'farm' | 'friends' | 'tournaments'

interface Props {
    active: NavKey
    eggsBadge?: number
    questsDot?: boolean
    onShop: () => void
    onQuests: () => void
    onFarm: () => void
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
                              onFarm,
                              onFriends,
                              onTournaments,
                          }: Props) {
    // particles count is small => cheap on mobile
    const particles = useMemo(() => Array.from({ length: 10 }, (_, i) => i), [])

    return (
        <nav className="bottomnav" role="navigation" aria-label="Bottom navigation">
            {/* background FX layer */}
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
                <button
                    data-key="shop"
                    className={`bn-item ${active === 'shop' ? 'is-active' : ''}`}
                    onClick={() => {
                        tapSoft()
                        onShop()
                    }}
                    type="button"
                    aria-current={active === 'shop' ? 'page' : undefined}
                >
                    <div className="bn-ico">
                        <ShopIcon className="bn-svg" />
                    </div>
                    <div className="bn-txt">РЫНОК</div>
                </button>

                <button
                    data-key="quests"
                    className={`bn-item ${active === 'quests' ? 'is-active' : ''}`}
                    onClick={() => {
                        tapSoft()
                        onQuests()
                    }}
                    type="button"
                    aria-current={active === 'quests' ? 'page' : undefined}
                >
                    <div className="bn-ico bn-ico--eggs">
                        <QuestsIcon className="bn-svg" />
                        {questsDot && <span className="bn-dot" />}
                        {!!eggsBadge && (
                            <span className="bn-badge">{eggsBadge > 99 ? '99+' : eggsBadge}</span>
                        )}
                    </div>
                    <div className="bn-txt">ЗАДАНИЯ</div>
                </button>

                <button
                    data-key="farm"
                    className={`bn-center ${active === 'farm' ? 'is-active' : ''}`}
                    onClick={() => {
                        tapLight()
                        onFarm()
                    }}
                    type="button"
                    aria-current={active === 'farm' ? 'page' : undefined}
                >
                    <span className="bn-center-ring" aria-hidden="true" />
                    <FarmIcon className="bn-center-svg" />
                    <div className="bn-center-txt">FARM</div>
                </button>

                <button
                    data-key="friends"
                    className={`bn-item ${active === 'friends' ? 'is-active' : ''}`}
                    onClick={() => {
                        tapSoft()
                        onFriends()
                    }}
                    type="button"
                    aria-current={active === 'friends' ? 'page' : undefined}
                >
                    <div className="bn-ico">
                        <FriendsIcon className="bn-svg" />
                    </div>
                    <div className="bn-txt">ДРУЗЬЯ</div>
                </button>

                <button
                    data-key="tournaments"
                    className={`bn-item ${active === 'tournaments' ? 'is-active' : ''}`}
                    onClick={() => {
                        tapSoft()
                        onTournaments()
                    }}
                    type="button"
                    aria-current={active === 'tournaments' ? 'page' : undefined}
                >
                    <div className="bn-ico">
                        <TournamentIcon className="bn-svg" />
                    </div>
                    <div className="bn-txt">ТУРНИРЫ</div>
                </button>
            </div>
        </nav>
    )
}