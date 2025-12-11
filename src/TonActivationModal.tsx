import { useState } from "react";

export function TonActivationModal({ address, onClose }: {
    address: string;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <img style={{ width: 40 }} src="https://ton.org/assets/img/ton_symbol.svg" />
                    <h3 style={styles.title}>Активируйте TON-кошелёк</h3>
                </div>

                <p style={styles.text}>
                    Ваш кошелёк ещё не активирован на блокчейне.
                    Чтобы получить выплату в TON — отправьте
                    <b> любую транзакцию (0.05 TON)</b> из Tonkeeper.
                </p>

                <div style={styles.addressBox}>
                    <code style={styles.address}>
                        {address.slice(0, 6)}...{address.slice(-6)}
                    </code>
                    <button style={styles.copyBtn} onClick={handleCopy}>
                        {copied ? "✓" : "📋"}
                    </button>
                </div>

                <a
                    href="tonkeeper://"
                    style={styles.openBtn}
                >
                    Открыть Tonkeeper
                </a>

                <button style={styles.closeBtn} onClick={onClose}>
                    Понятно
                </button>
            </div>
        </div>
    );
}

const styles: Record<string, any> = {
    overlay: {
        position: "fixed",
        top: 0, left: 0,
        width: "100vw", height: "100vh",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
    },
    modal: {
        width: "90%",
        maxWidth: 360,
        background: "#ffffff",
        borderRadius: 20,
        padding: "20px 24px",
        textAlign: "center",
        animation: "fadeIn 0.3s ease",
        boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginBottom: 10,
    },
    title: {
        margin: 0,
        fontSize: 20,
        fontWeight: 600
    },
    text: {
        fontSize: 14,
        opacity: 0.8,
        lineHeight: 1.4
    },
    addressBox: {
        marginTop: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        borderRadius: 12,
        padding: "8px 12px"
    },
    address: {
        fontSize: 13,
        color: "#333",
        marginRight: 8,
    },
    copyBtn: {
        background: "transparent",
        border: "none",
        fontSize: 20,
        cursor: "pointer",
    },
    openBtn: {
        display: "block",
        marginTop: 18,
        background: "#0098ea",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: 12,
        fontSize: 16,
        textDecoration: "none",
        fontWeight: 600,
    },
    closeBtn: {
        marginTop: 10,
        background: "transparent",
        border: "none",
        fontSize: 15,
        color: "#666",
        cursor: "pointer",
    },
};
