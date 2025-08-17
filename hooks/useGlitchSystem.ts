import { useState, useEffect, useCallback } from 'https://esm.sh/react';
import { PlayerState, GameConfig, GlitchEvent } from '../types';

interface UseGlitchSystemProps {
    playerState: PlayerState | null;
    setPlayerState: React.Dispatch<React.SetStateAction<PlayerState | null>>;
    config: GameConfig | null;
    savePlayerState: (state: PlayerState, taps?: number) => Promise<PlayerState | null>;
    isFinalScene: boolean;
}

const SHOWN_GLITCHES_STORAGE_KEY = 'shownGlitchCodes_v1';

const getInitialShownCodes = (): Set<string> => {
    try {
        const storedCodes = localStorage.getItem(SHOWN_GLITCHES_STORAGE_KEY);
        if (storedCodes) {
            return new Set(JSON.parse(storedCodes));
        }
    } catch (e) {
        console.error("Failed to parse shown glitch codes from localStorage", e);
    }
    return new Set();
};


export const useGlitchSystem = ({
    playerState,
    setPlayerState,
    config,
    savePlayerState,
    isFinalScene,
}: UseGlitchSystemProps) => {
    const [metaTaps, setMetaTaps] = useState<Record<string, number>>({});
    const [activeGlitchEvent, setActiveGlitchEvent] = useState<GlitchEvent | null>(null);
    const [shownCodes, setShownCodes] = useState(getInitialShownCodes);


    const triggerGlitchEvent = useCallback((event: GlitchEvent) => {
        if (!playerState || activeGlitchEvent || isFinalScene) return;

        const isDiscovered = (playerState.discoveredGlitchCodes || []).map(String).includes(String(event.code));
        if (isDiscovered) return;
        
        const discovered = new Set(playerState.discoveredGlitchCodes || []);
        discovered.add(event.code);
        const updatedPlayerState = { ...playerState, discoveredGlitchCodes: Array.from(discovered) };
        
        setPlayerState(updatedPlayerState);
        savePlayerState(updatedPlayerState, 0); 
    }, [playerState, activeGlitchEvent, isFinalScene, setPlayerState, savePlayerState]);

    const handleMetaTap = useCallback((targetId: string) => {
        setMetaTaps(prev => ({ ...prev, [targetId]: (prev[targetId] || 0) + 1 }));
    }, []);

    // --- CLIENT-SIDE GLITCH TRIGGERS ---
    useEffect(() => {
        if (!config?.glitchEvents || isFinalScene || activeGlitchEvent) return;
        const now = new Date();
        config.glitchEvents.forEach(e => {
            if (e.trigger?.type === 'login_at_time' && e.trigger.params &&
                e.trigger.params.hour === now.getHours() &&
                e.trigger.params.minute === now.getMinutes()) {
                triggerGlitchEvent(e);
            }
        });
    }, [config?.glitchEvents, triggerGlitchEvent, isFinalScene, activeGlitchEvent]);

    useEffect(() => {
        if (!config?.glitchEvents || !playerState || activeGlitchEvent || isFinalScene) return;

        for (const targetId in metaTaps) {
            const tapCount = metaTaps[targetId];
            if (tapCount > 0) {
                const event = config.glitchEvents.find(e => 
                    e.trigger?.type === 'meta_tap' &&
                    e.trigger?.params?.targetId === targetId &&
                    tapCount >= (e.trigger.params.taps || 999)
                );

                if (event) {
                    triggerGlitchEvent(event);
                    setMetaTaps(prev => ({ ...prev, [targetId]: 0 }));
                    break;
                }
            }
        }
    }, [metaTaps, config?.glitchEvents, activeGlitchEvent, triggerGlitchEvent, playerState, isFinalScene]);

    // --- UNIFIED GLITCH EFFECT DISPLAY ---
    useEffect(() => {
        if (!playerState || !config?.glitchEvents || activeGlitchEvent || isFinalScene) {
            return;
        }

        const newCodeToShow = (playerState.discoveredGlitchCodes || [])
            .find(code => !shownCodes.has(String(code)));

        if (newCodeToShow) {
            const event = config.glitchEvents.find(e => String(e.code) === String(newCodeToShow));
            if (event) {
                setActiveGlitchEvent(event);
                
                // Update shown codes state and persist to localStorage
                setShownCodes(prevShownCodes => {
                    const newSet = new Set(prevShownCodes);
                    newSet.add(String(newCodeToShow));
                    try {
                        localStorage.setItem(SHOWN_GLITCHES_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
                    } catch (e) {
                        console.error("Failed to save shown glitch codes to localStorage", e);
                    }
                    return newSet;
                });
            }
        }
    }, [playerState, config?.glitchEvents, activeGlitchEvent, isFinalScene, shownCodes]);
    
    return {
        activeGlitchEvent,
        setActiveGlitchEvent,
        handleMetaTap,
    };
};