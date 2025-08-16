import React, { useRef, useEffect, useState } from 'https://esm.sh/react';

// Re-add html2canvas declaration
declare const html2canvas: any;

const FinalSystemBreachEffect: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [uiScreenshot, setUiScreenshot] = useState<string | null>(null);
    const [stage, setStage] = useState(0); // 0: init, 1: resistance, 2: dissolve, 3: revelation, 4: message typed

    const propagandaWords = ['OBEY', 'CONFORM', 'SUBMIT', 'THINK LESS', 'WORK MORE', 'BIG BROTHER IS WATCHING', 'IGNORANCE IS STRENGTH'];
    const finalMessage = "СОЗНАНИЕ - ЭТО СВОБОДА";
    const [typedMessage, setTypedMessage] = useState('');

    // Capture UI on mount
    useEffect(() => {
        const content = document.getElementById('main-content-wrapper');
        if (!content) return;

        html2canvas(content, { 
            backgroundColor: null, 
            scale: 1,
            useCORS: true // This is crucial for external images
        }).then(canvas => {
            setUiScreenshot(canvas.toDataURL());
            setStage(1); // Start resistance phase
        }).catch(err => {
            console.error("html2canvas failed:", err);
            // Fallback: just proceed without screenshot
            setStage(1);
        });

        // Hide original content
        content.style.visibility = 'hidden';
        return () => {
            if (content) content.style.visibility = 'visible';
        };
    }, []);

    // Animation stage manager
    useEffect(() => {
        if (stage === 1) { // Resistance
            const timer = setTimeout(() => setStage(2), 3000);
            return () => clearTimeout(timer);
        }
        if (stage === 2) { // Dissolve
            const timer = setTimeout(() => setStage(3), 2000);
            return () => clearTimeout(timer);
        }
        if (stage === 4) { // Message typed, wait then complete
             const timer = setTimeout(() => onComplete(), 3000);
            return () => clearTimeout(timer);
        }
    }, [stage, onComplete]);


    // Digital Rain Effect
    useEffect(() => {
        if (stage < 3) return; // Only run when revelation starts
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
        const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const nums = '0123456789';
        const alphabet = katakana + latin + nums;

        const fontSize = 16;
        const columns = Math.ceil(canvas.width / fontSize);
        const rainDrops: number[] = [];

        for (let x = 0; x < columns; x++) {
            rainDrops[x] = 1;
        }

        let animationFrameId: number;
        const render = () => {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.1)'; // Fading effect
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#4ade80'; // Green text
            ctx.font = fontSize + 'px monospace';

            for (let i = 0; i < rainDrops.length; i++) {
                const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
                ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);

                if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    rainDrops[i] = 0;
                }
                rainDrops[i]++;
            }
            animationFrameId = requestAnimationFrame(render);
        };
        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [stage]);

    // Typing message effect
    useEffect(() => {
        if (stage !== 3) return;
        
        setTypedMessage(''); // Reset before typing
        
        const typingInterval = setInterval(() => {
            setTypedMessage(prev => {
                if (prev.length < finalMessage.length) {
                    return finalMessage.substring(0, prev.length + 1);
                } else {
                    clearInterval(typingInterval);
                    setStage(4); // Move to next stage when done
                    return prev;
                }
            });
        }, 150);

        return () => clearInterval(typingInterval);
    }, [stage, finalMessage]);


    return (
        <div ref={containerRef} className="system-breach-container">
            {/* Stage 1: Resistance */}
            {stage >= 1 && (
                <div className="propaganda-overlay">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="propaganda-text" style={{
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            animationDuration: `${2 + Math.random() * 4}s`,
                            animationDelay: `${Math.random() * 2}s`
                        }}>
                            {propagandaWords[Math.floor(Math.random() * propagandaWords.length)]}
                        </div>
                    ))}
                </div>
            )}
             <div className={`scanline-overlay ${stage >= 1 ? 'active' : ''}`}></div>

            {/* Stage 2: Dissolve */}
            {uiScreenshot && (
                <div className={`dissolve-image ${stage >= 2 ? 'dissolving' : ''}`}>
                    <img src={uiScreenshot} alt="UI Snapshot" />
                </div>
            )}

            {/* Stage 3: Revelation */}
            {stage >= 3 && <canvas ref={canvasRef} className="digital-rain-canvas"></canvas>}
            {stage >= 3 && (
                 <div className="freedom-message-container">
                    <p className="freedom-message">
                        {typedMessage}
                        {stage < 4 && <span className="blinking-cursor">_</span>}
                    </p>
                </div>
            )}
        </div>
    );
};

export default FinalSystemBreachEffect;