import './BottomNav.css';

type NavKey = 'shop' | 'quests' | 'demon' | 'friends' | 'tournaments';

export function BottomNav({
                              active,
                              eggsBadge,
                              onShop,
                              onQuests,
                              onDemon,
                              onFriends,
                              onTournaments,
                          }: {
    active: NavKey;
    eggsBadge?: number; // если хочешь бейдж, например 25
    onShop: () => void;
    onQuests: () => void;
    onDemon: () => void;
    onFriends: () => void;
    onTournaments: () => void;
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
                        🎯
                        {!!eggsBadge && <span className="bn-badge">{eggsBadge}</span>}
                    </div>
                    <div className="bn-txt">ЗАДАНИЯ</div>
                </button>

                {/* Центр (Демон) */}
                <button
                    className={`bn-center ${active === 'demon' ? 'is-active' : ''}`}
                    onClick={onDemon}
                >
                    <div className="bn-center-ico">😈</div>
                    <div className="bn-center-txt">ДЕМОН</div>
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
                    <div className="bn-ico">🏆</div>
                    <div className="bn-txt">ТУРНИРЫ</div>
                </button>
            </div>
        </nav>
    );
}
