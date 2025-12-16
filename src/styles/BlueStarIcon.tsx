// src/ui/BlueStarIcon.tsx

type BlueStarIconProps = {
    size?: number;
};

export const BlueStarIcon: React.FC<BlueStarIconProps> = ({ size = 14 }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
        >
            <defs>
                <linearGradient id="blueStar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7dd3fc" />
                    <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
            </defs>

            <path
                d="M12 2l2.9 6.9L22 9.7l-5 4.9L18.2 22 12 18.4 5.8 22 7 14.6l-5-4.9 7.1-.8L12 2z"
                fill="url(#blueStar)"
            />
        </svg>
    );
};
