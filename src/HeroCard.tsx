import './Hero.css';

interface HeroCardProps {
    level: number;
    xp: number;
}

export function HeroCard({ level, xp }: HeroCardProps) {
    // безопасные значения, если с сервера пришло что-то странное
    const safeLevel = Number.isFinite(level) && level > 0 ? level : 1;
    const safeXp = Number.isFinite(xp) && xp >= 0 ? xp : 0;

    // определяем стадию героя
    let heroEmoji = '👶';
    let title = 'Новичок';

    if (safeLevel >= 5 && safeLevel < 10) {
        heroEmoji = '🧙‍♂️';
        title = 'Охотник';
    } else if (safeLevel >= 10) {
        heroEmoji = '🐉';
        title = 'Легенда';
    }

    const xpForNext = 100 + (safeLevel - 1) * 50;
    const progress = Math.min(
        1,
        xpForNext > 0 ? safeXp / xpForNext : 0
    );

    return (
        <div className="hero-card">
            <div className="hero-left">
                <div className="hero-avatar">
                    <span className="hero-emoji">{heroEmoji}</span>
                </div>
                <div className="hero-info">
                    <div className="hero-title">{title}</div>
                    <div className="hero-level">Уровень {safeLevel}</div>
                </div>
            </div>

            <div className="hero-xp-block">
                <div className="hero-xp-label">
                    Опыт: {safeXp} / {xpForNext}
                </div>
                <div className="hero-xp-bar">
                    <div
                        className="hero-xp-fill"
                        style={{ transform: `scaleX(${progress})` }}
                    />
                </div>
            </div>
        </div>
    );
}
