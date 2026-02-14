import './BottomNav.css';

type NavKey = 'shop' | 'quests' | 'farm' | 'friends' | 'tournaments';

export function BottomNav({
                              active,
                              eggsBadge,
                              onShop,
                              onQuests,
                              onFarm,
                              onFriends,
                              onTournaments,
                              questsDot,
                          }: {
    active: NavKey;
    eggsBadge?: number;
    onShop: () => void;
    onQuests: () => void;
    onFarm: () => void;           // ✅ вместо onDemon
    onFriends: () => void;
    onTournaments: () => void;
    questsDot?: boolean;
}) {
    return (
        <nav className="bottomnav" role="navigation" aria-label="Bottom navigation">
            <div className="bottomnav-inner">
                <button
                    className={`bn-item ${active === 'shop' ? 'is-active' : ''}`}
                    onClick={onShop}
                >
                    <div className="bn-ico">📈</div>
                    <div className="bn-txt">РЫНОК</div>
                </button>

                <button
                    className={`bn-item ${active === 'quests' ? 'is-active' : ''}`}
                    onClick={onQuests}
                >
                    <div className="bn-ico bn-ico--eggs">
                        📝
                        {questsDot && <span className="bn-dot" />}
                        {!!eggsBadge && <span className="bn-badge">{eggsBadge}</span>}
                    </div>
                    <div className="bn-txt">ЗАДАНИЯ</div>
                </button>

                {/* 🔥 Центр теперь FARM */}
                <button
                    className={`bn-center ${active === 'farm' ? 'is-active' : ''}`}
                    onClick={onFarm}
                >
                    <div className="bn-center-ico">🌾</div>
                    <div className="bn-center-txt">FARM</div>
                </button>

                <button
                    className={`bn-item ${active === 'friends' ? 'is-active' : ''}`}
                    onClick={onFriends}
                >
                    <div className="bn-ico">👥</div>
                    <div className="bn-txt">ДРУЗЬЯ</div>
                </button>

                <button
                    className={`bn-item ${active === 'tournaments' ? 'is-active' : ''}`}
                    onClick={onTournaments}
                >
                    <div className="bn-ico">🎯</div>
                    <div className="bn-txt">ТУРНИРЫ</div>
                </button>
            </div>
        </nav>
    );
}
