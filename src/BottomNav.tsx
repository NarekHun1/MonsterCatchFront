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
    return (
        <nav className="bottomnav" role="navigation" aria-label="Bottom navigation">
            <div className="bottomnav-inner">

                <button
                    className={`bn-item ${active === 'shop' ? 'is-active' : ''}`}
                    onClick={onShop}
                    type="button"
                >
                    <div className="bn-ico">
                        <ShopIcon className="bn-svg" />
                    </div>
                    <div className="bn-txt">РЫНОК</div>
                </button>

                <button
                    className={`bn-item ${active === 'quests' ? 'is-active' : ''}`}
                    onClick={onQuests}
                    type="button"
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
                    className={`bn-center ${active === 'farm' ? 'is-active' : ''}`}
                    onClick={onFarm}
                    type="button"
                >
                    <FarmIcon className="bn-center-svg" />
                    <div className="bn-center-txt">FARM</div>
                </button>

                <button
                    className={`bn-item ${active === 'friends' ? 'is-active' : ''}`}
                    onClick={onFriends}
                    type="button"
                >
                    <div className="bn-ico">
                        <FriendsIcon className="bn-svg" />
                    </div>
                    <div className="bn-txt">ДРУЗЬЯ</div>
                </button>

                <button
                    className={`bn-item ${active === 'tournaments' ? 'is-active' : ''}`}
                    onClick={onTournaments}
                    type="button"
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