import { State, EXCHANGE_RATE } from './state.js';
import { 
    initAtmosphere, 
    closeMobileMenu, 
    openMobileMenu, 
    toggleAuthModal, 
    switchAuthTab, 
    switchSwapTab, 
    toast, 
    playSound, 
    toggleChat, 
    sendChat, 
    handleChatKey, 
    startChatLoop, 
    startLiveFeed, 
    initTimers 
} from './ui.js';
import { 
    connectWallet, 
    setMaxBet, 
    openGame, 
    closeGame, 
    toggleTutorial, 
    copyRefLink, 
    mintNFT, 
    stakeNFT, 
    unstakeNFT, 
    claimRewards, 
    loadUserData,
    buyTokens
} from './web3.js';

// --- INITIALIZE APP ---
function init() {
    // Initialize atmosphere effects
    initAtmosphere();
    
    // Start chat simulation
    startChatLoop();
    
    // Start live feed
    startLiveFeed();
    
    // Initialize timers
    initTimers();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup swap input listeners
    setupSwapListeners();
    
    // Expose functions to window for inline handlers
    exposeToWindow();
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Mobile menu button
    document.getElementById('mobileMenuBtn').addEventListener('click', openMobileMenu);
    
    // Modal connect button
    document.getElementById('modalConnectBtn').addEventListener('click', connectWallet);
    
    // Mute button
    document.getElementById('muteBtn').addEventListener('click', () => {
        State.settings.muted = !State.settings.muted;
        const icon = document.querySelector('#muteBtn i');
        if(State.settings.muted) { 
            icon.className = 'fas fa-volume-mute text-red-500'; 
        } else { 
            icon.className = 'fas fa-volume-up'; 
            playSound('click'); 
        }
    });
    
    // Buy button
    document.getElementById('buyBtn').addEventListener('click', buyTokens);
}

// --- SWAP INPUT LISTENERS ---
function setupSwapListeners() {
    const ethInput = document.getElementById('buyInputETH');
    const pbjInput = document.getElementById('buyInputPBJ');

    ethInput.addEventListener('input', (e) => {
        const ethVal = parseFloat(e.target.value);
        if(!isNaN(ethVal)) {
            pbjInput.value = (ethVal * EXCHANGE_RATE).toFixed(0);
        } else {
            pbjInput.value = '';
        }
    });

    pbjInput.addEventListener('input', (e) => {
        const pbjVal = parseFloat(e.target.value);
        if(!isNaN(pbjVal)) {
            ethInput.value = (pbjVal / EXCHANGE_RATE).toFixed(6);
        } else {
            ethInput.value = '';
        }
    });
}

// --- EXPOSE FUNCTIONS TO WINDOW ---
// These are needed for inline onclick handlers in HTML
function exposeToWindow() {
    window.closeMobileMenu = closeMobileMenu;
    window.toggleAuthModal = toggleAuthModal;
    window.switchAuthTab = switchAuthTab;
    window.switchSwapTab = switchSwapTab;
    window.toast = toast;
    window.toggleChat = toggleChat;
    window.sendChat = sendChat;
    window.handleChatKey = handleChatKey;
    window.openGame = openGame;
    window.closeGame = closeGame;
    window.toggleTutorial = toggleTutorial;
    window.setMaxBet = setMaxBet;
    window.copyRefLink = copyRefLink;
    window.mintNFT = mintNFT;
    window.stakeNFT = stakeNFT;
    window.unstakeNFT = unstakeNFT;
    window.claimRewards = claimRewards;
    window.loadUserData = loadUserData;
}

// --- RUN ON DOM READY ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
