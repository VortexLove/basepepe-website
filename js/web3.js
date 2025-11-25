import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import Web3Modal from "https://esm.sh/web3modal@1.9.12";
import WalletConnectProvider from "https://esm.sh/@walletconnect/web3-provider@1.8.0";
import { State, CONSTANTS, ABIS, TUTORIALS } from './state.js';
import { toast, playSound, toggleAuthModal, startAnimation, stopAnimation, animateWinToBalance } from './ui.js';

// --- WEB3MODAL CONFIGURATION ---
const providerOptions = {
    walletconnect: {
        package: WalletConnectProvider,
        options: {
            rpc: {
                8453: "https://mainnet.base.org" // Base Network RPC
            },
            chainId: 8453
        }
    }
};

const web3Modal = new Web3Modal({
    cacheProvider: true, // Mantiene la sesión activa al recargar
    providerOptions, 
    theme: "dark"
});

// --- NETWORK CHECK ---
export async function checkNetwork(provider) {
    if (!provider) return false;
    
    try {
        const chainId = await provider.request({ method: 'eth_chainId' });
        // Algunos proveedores devuelven hex, otros int
        const currentChainIdHex = typeof chainId === 'number' ? `0x${chainId.toString(16)}` : chainId;

        if (currentChainIdHex !== CONSTANTS.CHAIN_ID_HEX) {
            try {
                await provider.request({ 
                    method: 'wallet_switchEthereumChain', 
                    params: [{ chainId: CONSTANTS.CHAIN_ID_HEX }] 
                });
                return true;
            } catch (error) {
                // Error 4902: La red no existe en la wallet, intentamos añadirla
                if (error.code === 4902) {
                    try {
                        await provider.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: CONSTANTS.CHAIN_ID_HEX,
                                chainName: 'Base',
                                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                                rpcUrls: ['https://mainnet.base.org'],
                                blockExplorerUrls: ['https://basescan.org']
                            }],
                        });
                        return true;
                    } catch (addError) {
                        console.error(addError);
                    }
                }
                toast("Please switch to Base Network", "error");
                return false;
            }
        }
        return true;
    } catch (e) {
        console.error("Network check failed:", e);
        return true; // Asumimos éxito si falla la comprobación para no bloquear
    }
}

// --- WALLET CONNECTION ---
export async function connectWallet() {
    try { 
        // Abre el modal de selección de wallet
        const instance = await web3Modal.connect();

        // Eventos para cambios de cuenta o red
        instance.on("accountsChanged", (accounts) => {
            window.location.reload();
        });
        instance.on("chainChanged", (chainId) => {
            window.location.reload();
        });
        instance.on("disconnect", (error) => {
            State.wallet = {}; 
            window.location.reload();
        });

        // Verificar red antes de continuar
        const isCorrectChain = await checkNetwork(instance);
        if(!isCorrectChain) return;

        // Inicializar Ethers con el proveedor de Web3Modal
        State.wallet.provider = new ethers.providers.Web3Provider(instance); 
        State.wallet.signer = State.wallet.provider.getSigner(); 
        State.wallet.address = await State.wallet.signer.getAddress(); 
        
        // Inicializar Contratos
        State.contracts.token = new ethers.Contract(CONSTANTS.ADDR.TOKEN, ABIS.TOKEN, State.wallet.signer); 
        State.contracts.presale = new ethers.Contract(CONSTANTS.ADDR.PRESALE, ABIS.PRESALE, State.wallet.signer); 
        State.contracts.blackjack = new ethers.Contract(CONSTANTS.ADDR.BLACKJACK, ABIS.BLACKJACK, State.wallet.signer); 
        State.contracts.instant = new ethers.Contract(CONSTANTS.ADDR.INSTANT, ABIS.INSTANT, State.wallet.signer); 
        State.contracts.nft = new ethers.Contract(CONSTANTS.ADDR.NFT, ABIS.NFT, State.wallet.signer); 
        
        updateUI(); 
        loadUserData(); 
        unlockPartners(); 
        listenForWins(); 
        
        // Cerrar modal de login si está abierto
        const authModal = document.getElementById('authModal');
        if (authModal && !authModal.classList.contains('hidden')) {
            toggleAuthModal(); 
        }
        
        toast("PICKAXE CONNECTED"); 
    } catch(e) { 
        console.error(e); 
        if (e?.message !== "User closed modal") {
            toast("Connection Failed", "error"); 
        }
    } 
}

// --- DISCONNECT WALLET ---
export async function disconnectWallet() {
    await web3Modal.clearCachedProvider();
    window.location.reload();
}

// --- UI UPDATE ---
export async function updateUI() { 
    document.getElementById('loginBtn').classList.add('hidden'); 
    document.getElementById('connectBtn').classList.remove('hidden'); 
    document.getElementById('connectBtn').innerHTML = `<i class="fas fa-user mr-1"></i> ${State.wallet.address.substring(0,6)}...`; 
    
    // Añadir click para desconectar
    document.getElementById('connectBtn').onclick = disconnectWallet;

    try { 
        // Balance PBJ
        const bal = await State.contracts.token.balanceOf(State.wallet.address); 
        State.wallet.balance = parseFloat(ethers.utils.formatUnits(bal, 18));
        const fmt = Math.floor(State.wallet.balance); 
        
        // Show Credits in headerBalance (main display)
        const creditsFmt = Math.floor(State.wallet.credits);
        document.getElementById('headerBalance').innerText = creditsFmt.toLocaleString(); 
        document.getElementById('modalBalance').innerText = creditsFmt.toLocaleString(); 
        document.getElementById('walletDisplay').style.display = 'flex'; 

        // Balance ETH
        const ethBal = await State.wallet.signer.getBalance();
        const ethFmt = parseFloat(ethers.utils.formatEther(ethBal)).toFixed(4);
        document.getElementById('ethBalDisplay').innerText = ethFmt;
    } catch(e) {} 
}

// --- DEPOSIT CREDITS ---
export async function depositCredits(amount) {
    if(!State.wallet.signer) return toast("CONNECT PICKAXE", "error");
    if(!amount || amount <= 0) return toast("Invalid Amount", "error");
    if(amount > State.wallet.balance) return toast("Insufficient PBJ Balance", "error");

    try {
        const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
        
        // Check allowance for TREASURY
        const allow = await State.contracts.token.allowance(State.wallet.address, CONSTANTS.ADDR.TREASURY);
        if(allow.lt(amountWei)) {
            toast("Approving PBJ...", "info");
            const txApp = await State.contracts.token.approve(CONSTANTS.ADDR.TREASURY, ethers.constants.MaxUint256);
            await txApp.wait();
        }
        
        // Transfer to TREASURY
        toast("Depositing Credits...", "info");
        const tx = await State.contracts.token.transfer(CONSTANTS.ADDR.TREASURY, amountWei);
        await tx.wait();
        
        // Update credits
        State.wallet.credits += parseFloat(amount);
        toast("Credits Deposited");
        updateUI();
    } catch(e) {
        console.error(e);
        toast("Deposit Failed", "error");
    }
}

// --- WITHDRAW CREDITS ---
export async function withdrawCredits(amount) {
    if(!State.wallet.signer) return toast("CONNECT PICKAXE", "error");
    if(!amount || amount <= 0) return toast("Invalid Amount", "error");
    if(amount > State.wallet.credits) return toast("Insufficient Credits", "error");

    // Deduct credits
    State.wallet.credits -= parseFloat(amount);
    
    // Simulate backend withdrawal request
    toast("Withdrawal Request Sent to Backend");
    updateUI();
}

// --- SET MAX BET ---
export function setMaxBet() { 
    if(!State.wallet.address) return; 
    document.getElementById('gameBetInput').value = State.wallet.credits; 
}

// --- GAME MODAL ---
export function openGame(game) { 
    State.game.current = game; 
    const m = document.getElementById('gameModal'); 
    const c = document.getElementById('innerGameContent'); 
    const t = document.getElementById('modalTitle'); 
    const btn = document.getElementById('gameActionBtn'); 
    const extra = document.getElementById('gameExtraControls'); 
    const status = document.getElementById('gameStatus'); 
    
    m.classList.remove('hidden'); 
    m.classList.add('flex'); 
    extra.innerHTML = ''; 
    extra.classList.add('hidden'); 
    status.innerText = "READY TO DIG"; 
    status.className = "bg-black py-2 text-center text-xs font-mono uppercase tracking-widest text-gray-500"; 
    btn.onclick = () => executeGame(game); 
    
    // Reset Views
    if (game === 'slots') { 
        t.innerText = "GEM SLOTS"; 
        c.innerHTML = `<div class="flex gap-2" id="slotRes"><div class="slot-reel">💎</div><div class="slot-reel">⛏️</div><div class="slot-reel">💰</div></div>`; 
    } else if (game === 'dice') { 
        t.innerText = "DICE"; 
        c.innerHTML = `<div class="text-6xl font-bold text-white font-mono" id="diceRes">50</div><div class="text-xs text-primary mt-2 font-mono">&lt; ROLL UNDER 50 &gt;</div>`; 
    } else if (game === 'blackjack') { 
        t.innerText = "BLACKJACK"; 
        c.innerHTML = `<div class="flex flex-col gap-6 w-full p-4"><div class="text-center bg-[#111] p-4 rounded border border-[#333]"><p class="text-[10px] text-gray-500 mb-1 uppercase">Dealer</p><div id="bjDealer" class="min-h-[60px] flex justify-center items-center"><span class="text-gray-700 text-xs">WAITING...</span></div></div><div class="text-center bg-[#111] p-4 rounded border border-[#333]"><p class="text-[10px] text-gray-500 mb-1 uppercase">You</p><div id="bjPlayer" class="min-h-[60px] flex justify-center items-center"><span class="text-gray-700 text-xs">WAITING...</span></div></div></div>`;
    } else if (game === 'roulette') { 
        t.innerText = "ROULETTE"; 
        c.innerHTML = `<div class="text-6xl font-bold mb-2 text-white font-mono" id="rouletteRes">0</div>`; 
        extra.classList.remove('hidden'); 
        extra.innerHTML = `<button onclick="window.rouletteChoice=0" class="bg-red-600 hover:bg-red-500 text-white p-2 rounded text-xs font-bold flex-1">RED</button><button onclick="window.rouletteChoice=1" class="bg-black hover:bg-gray-900 text-white p-2 rounded text-xs font-bold flex-1 border border-gray-600">BLACK</button><button onclick="window.rouletteChoice=2" class="bg-green-600 hover:bg-green-500 text-white p-2 rounded text-xs font-bold flex-1">GREEN</button>`;
        window.rouletteChoice = 0; 
    } else if (game === 'crash') { 
        t.innerText = "ROCKET CART"; 
        c.innerHTML = `<div class="text-6xl font-bold text-primary font-mono drop-shadow-[0_0_10px_rgba(57,255,20,0.8)]" id="crashRes">1.00x</div>`; 
        extra.classList.remove('hidden'); 
        extra.innerHTML = `<input type="number" id="crashOut" value="2.00" step="0.1" class="bg-black border border-gray-600 rounded p-2 w-24 text-center text-white outline-none font-mono" placeholder="2.00">`;
    } else if (game === 'plinko') { 
        t.innerText = "GEM DROP"; 
        c.innerHTML = `<div class="text-6xl font-bold text-white font-mono animate-bounce" id="plinkoRes">DROP</div>`; 
    } else if (game === 'keno') { 
        t.innerText = "ORE SCANNER"; 
        c.innerHTML = `<div class="text-6xl font-bold text-white font-mono" id="kenoRes">SCAN</div>`; 
    } else if (game === 'mines') { 
        t.innerText = "MINEFIELD"; 
        let g = '<div class="mines-grid" id="minesGrid">'; 
        for(let i=0; i<25; i++) g+= `<div class="mine-cell bg-gray-700"></div>`; 
        g += '</div>'; 
        c.innerHTML = g; 
    } else if (game === 'tower') { 
        t.innerText = "MINE SHAFT"; 
        c.innerHTML = `<div class="text-6xl font-bold text-white font-mono" id="towerRes">CLIMB</div>`; 
        extra.classList.remove('hidden'); 
        extra.innerHTML = `<button onclick="window.towerDiff=0" class="bg-green-900 text-white p-2 rounded text-xs font-bold flex-1 border border-green-700">EASY</button><button onclick="window.towerDiff=1" class="bg-yellow-900 text-white p-2 rounded text-xs font-bold flex-1 border border-yellow-700">MED</button><button onclick="window.towerDiff=2" class="bg-red-900 text-white p-2 rounded text-xs font-bold flex-1 border border-red-700">HARD</button>`;
        window.towerDiff = 1; 
    } 
}

export function closeGame() { 
    document.getElementById('gameModal').classList.add('hidden'); 
    document.getElementById('gameModal').classList.remove('flex'); 
    stopAnimation(); 
    State.game.current=null; 
    State.game.isPlaying = false;
}

export function toggleTutorial() { 
    const overlay = document.getElementById('tutorialOverlay'); 
    if(overlay.classList.contains('hidden') && State.game.current) { 
        const data = TUTORIALS[State.game.current]; 
        document.getElementById('tutTitle').innerText = data.t; 
        document.getElementById('tutText').innerText = data.d; 
        overlay.classList.remove('hidden'); overlay.classList.add('flex'); 
    } else { 
        overlay.classList.add('hidden'); overlay.classList.remove('flex'); 
    } 
}

// --- GAME EXECUTION (OFF-CHAIN CREDITS) ---
async function executeGame(game) { 
    if(!State.wallet.signer) return toast("CONNECT PICKAXE", "error"); 
    if(State.game.isPlaying) return; 

    const betVal = parseFloat(document.getElementById('gameBetInput').value);
    if(betVal <= 0) return toast("Invalid Amount", "error");
    if(betVal > State.wallet.credits) return toast("Insufficient Credits", "error");

    const btn = document.getElementById('gameActionBtn'); 
    
    try {
        State.game.isPlaying = true;
        btn.disabled = true; 
        btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> MINING...`; 
        
        // Deduct credits before playing
        State.wallet.credits -= betVal;

        playSound('spin'); 
        startAnimation(game);

        // Simulate game processing delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        let win = false;
        let payout = 0;
        let resultData = {};

        // Local RNG Game Logic
        switch(game) { 
            case 'slots': {
                // Random 3 emojis (0-6). If 3 match -> Win 10x
                const symbols = [
                    Math.floor(Math.random() * 7),
                    Math.floor(Math.random() * 7),
                    Math.floor(Math.random() * 7)
                ];
                win = symbols[0] === symbols[1] && symbols[1] === symbols[2];
                payout = win ? betVal * 10 : 0;
                resultData = { outcome: symbols };
                break;
            }
            case 'dice': {
                // Random 0-99. If < 50 -> Win 2x
                const rolled = Math.floor(Math.random() * 100);
                win = rolled < 50;
                payout = win ? betVal * 2 : 0;
                resultData = { rolled };
                break;
            }
            case 'roulette': {
                // Random 0-36. Player picks red(0), black(1), or green(2)
                const roll = Math.floor(Math.random() * 37);
                const choice = window.rouletteChoice || 0;
                // 0 = green, 1-18 odd = red, 19-36 even = red, etc (simplified)
                const isGreen = roll === 0;
                const isRed = !isGreen && roll % 2 === 1;
                if(choice === 2 && isGreen) {
                    win = true;
                    payout = betVal * 35; // Green pays 35x
                } else if(choice === 0 && isRed) {
                    win = true;
                    payout = betVal * 2;
                } else if(choice === 1 && !isRed && !isGreen) {
                    win = true;
                    payout = betVal * 2;
                }
                resultData = { roll, color: isGreen ? 'green' : (isRed ? 'red' : 'black') };
                break;
            }
            case 'crash': {
                // Random crash point (1.00x to 10.00x)
                const crashPoint = 1 + Math.random() * 9;
                const cashoutTarget = parseFloat(document.getElementById('crashOut').value) || 2.00;
                win = cashoutTarget < crashPoint;
                payout = win ? betVal * cashoutTarget : 0;
                resultData = { crashPoint: Math.floor(crashPoint * 100), cashoutPoint: Math.floor(cashoutTarget * 100) };
                break;
            }
            case 'mines': {
                // Simple 50/50 win for demo
                const exploded = Math.random() >= 0.5;
                win = !exploded;
                payout = win ? betVal * 2 : 0;
                resultData = { exploded };
                break;
            }
            case 'blackjack': {
                // Simple 50/50 win for demo
                win = Math.random() >= 0.5;
                payout = win ? betVal * 2 : 0;
                const playerScore = win ? Math.floor(Math.random() * 4) + 18 : Math.floor(Math.random() * 5) + 17;
                const dealerScore = win ? Math.floor(Math.random() * 5) + 17 : Math.floor(Math.random() * 4) + 18;
                resultData = { playerScore, dealerScore, won: win };
                break;
            }
            case 'plinko': {
                // Random bucket 0-8 with multipliers
                const multipliers = [0.5, 1, 1.5, 2, 5, 2, 1.5, 1, 0.5];
                const slot = Math.floor(Math.random() * 9);
                payout = betVal * multipliers[slot];
                win = multipliers[slot] >= 1;
                resultData = { slot };
                break;
            }
            case 'keno': {
                // Random 0-4 matches
                const matches = Math.floor(Math.random() * 5);
                const kenoMultipliers = [0, 1, 2, 5, 20];
                payout = betVal * kenoMultipliers[matches];
                win = matches >= 1;
                resultData = { matches };
                break;
            }
            case 'tower': {
                // Random level 0-5 reached
                const difficulty = Math.min(Math.max(window.towerDiff || 1, 0), 2);
                const levelReached = Math.floor(Math.random() * 6);
                const towerMultipliers = [[1, 1.2, 1.5, 2, 3, 5], [1, 1.5, 2, 3, 5, 10], [1, 2, 3, 5, 10, 20]];
                payout = levelReached > 0 ? betVal * towerMultipliers[difficulty][levelReached] : 0;
                win = levelReached > 0;
                resultData = { levelReached };
                break;
            }
        } 

        stopAnimation();

        // Credit payout if won
        if(win && payout > 0) {
            State.wallet.credits += payout;
        }

        // Show results based on game type
        if(game === 'blackjack') {
            renderCards('bjDealer', resultData.dealerScore);
            renderCards('bjPlayer', resultData.playerScore);
            showResCredits(payout, resultData.won ? "YOU WON!" : "DEALER WINS");
        } else if(game === 'dice') {
            showResCredits(payout, `ROLLED: ${resultData.rolled}`, 'diceRes', resultData.rolled);
        } else if(game === 'slots') {
            showResCredits(payout, `SYMBOLS: ${resultData.outcome.join('-')}`, 'slotRes', `<div class="flex gap-2"><div class="slot-reel">${emoji(resultData.outcome[0])}</div><div class="slot-reel">${emoji(resultData.outcome[1])}</div><div class="slot-reel">${emoji(resultData.outcome[2])}</div></div>`);
        } else if(game === 'roulette') {
            showResCredits(payout, `RESULT: ${resultData.roll} (${resultData.color})`, 'rouletteRes', resultData.roll);
        } else if(game === 'plinko') {
            showResCredits(payout, `BUCKET: ${resultData.slot}`, 'plinkoRes', `BIN ${resultData.slot}`);
        } else if(game === 'keno') {
            showResCredits(payout, `MATCHES: ${resultData.matches}`, 'kenoRes', `${resultData.matches} HITS`);
        } else if(game === 'mines') {
            showResCredits(payout, resultData.exploded ? "BOOM" : "SAFE");
            const cells = document.querySelectorAll('.mine-cell');
            cells.forEach(c => { c.className = resultData.exploded ? "mine-cell boom" : "mine-cell safe"; c.innerText = resultData.exploded ? "💣" : "💎"; });
        } else if(game === 'tower') {
            showResCredits(payout, `LEVEL: ${resultData.levelReached}`, 'towerRes', `LVL ${resultData.levelReached}`);
        } else if(game === 'crash') {
            const c = (resultData.crashPoint/100).toFixed(2);
            showResCredits(payout, `CRASHED @ ${c}x`, 'crashRes', c+"x");
        }

    } catch(e) { 
        console.error(e); 
        stopAnimation(); 
        // Refund credits on error
        State.wallet.credits += betVal;
        document.getElementById('gameStatus').innerText = "GAME FAILED"; 
        toast("Game Failed", "error"); 
    } finally {
        btn.disabled = false;
        btn.innerText = "START MINE";
        State.game.isPlaying = false;
    }
}

// --- HELPERS ---
function emoji(num) { return ['💎','⛏️','💰','🔦','🐸','🪙','7️⃣'][num] || num; }

// Credits-based result display (for off-chain games)
function showResCredits(payout, text, elemId = null, elemVal = null) { 
    stopAnimation(); 
    const btn = document.getElementById('gameActionBtn'); 
    const status = document.getElementById('gameStatus'); 
    
    btn.disabled = false; 
    btn.innerText = "PLAY AGAIN"; 
    State.game.isPlaying = false;

    const won = payout > 0; 
    const profitInt = Math.floor(payout);
    
    status.innerText = text + (won ? ` (+${profitInt} Credits)` : ""); 
    status.className = "bg-black py-2 text-center text-xs font-mono uppercase tracking-widest " + (won ? "text-primary" : "text-red-500"); 
    
    if(elemId && elemVal) { 
        const el = document.getElementById(elemId); 
        el.innerHTML = elemVal; 
        if(won) el.classList.add('animate-bounce'); 
    } 
    
    if(won) { 
        playSound('win'); 
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#39FF14', '#FFD700'] }); 
        animateWinToBalance(profitInt); 
        setTimeout(() => updateUI(), 1200);
    } else { 
        playSound('lose'); 
        updateUI(); 
    } 
}

// Legacy showRes for compatibility (if needed for on-chain events)
function showRes(payout, text, elemId = null, elemVal = null) { 
    stopAnimation(); 
    const btn = document.getElementById('gameActionBtn'); 
    const status = document.getElementById('gameStatus'); 
    
    btn.disabled = false; 
    btn.innerText = "PLAY AGAIN"; 
    State.game.isPlaying = false;

    const payVal = ethers.BigNumber.from(payout); 
    const won = payVal.gt(0); 
    const profit = ethers.utils.formatUnits(payVal, 18); 
    const profitInt = parseInt(profit); 
    
    status.innerText = text + (won ? ` (+${profitInt} PBJ)` : ""); 
    status.className = "bg-black py-2 text-center text-xs font-mono uppercase tracking-widest " + (won ? "text-primary" : "text-red-500"); 
    
    if(elemId && elemVal) { 
        const el = document.getElementById(elemId); 
        el.innerHTML = elemVal; 
        if(won) el.classList.add('animate-bounce'); 
    } 
    
    if(won) { 
        playSound('win'); 
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#39FF14', '#FFD700'] }); 
        animateWinToBalance(profitInt); 
        setTimeout(() => updateUI(), 1200);
    } else { 
        playSound('lose'); 
        updateUI(); 
    } 
}

// --- BLACKJACK LOGIC ---
function generateHandFromScore(targetScore) { 
    const suits = ['♠', '♥', '♦', '♣']; 
    const cards = []; 
    let currentSum = 0; 
    if (targetScore === 21) return [{val:'A', s:suits[0]}, {val:'K', s:suits[1]}]; 
    if (targetScore > 21) return [{val:'10', s:suits[2]}, {val:'10', s:suits[3]}, {val:'5', s:suits[0]}]; 
    while(currentSum < targetScore) { 
        let diff = targetScore - currentSum; 
        let val = diff > 10 ? 10 : diff; 
        if (currentSum === 0 && diff > 10) val = Math.floor(Math.random() * 9) + 2; 
        if (currentSum + val > targetScore) val = targetScore - currentSum; 
        currentSum += val; 
        let displayVal = val.toString(); 
        if (val === 1 || val === 11) displayVal = 'A'; 
        if (val === 10) displayVal = ['10', 'J', 'Q', 'K'][Math.floor(Math.random()*4)]; 
        cards.push({ val: displayVal, s: suits[Math.floor(Math.random() * 4)] }); 
    } 
    return cards; 
}

function renderCards(elementId, score) { 
    const container = document.getElementById(elementId); 
    const hand = generateHandFromScore(score); 
    let html = `<div class="flex gap-2 justify-center">`; 
    hand.forEach(c => { 
        const isRed = (c.s === '♥' || c.s === '♦'); 
        html += `<div class="card-visual ${isRed?'card-red':'card-black'}"><span>${c.val}</span><span class="text-xs">${c.s}</span></div>`; 
    }); 
    html += `</div><div class="text-xs mt-2 text-gray-400 font-mono">SCORE: ${score}</div>`; 
    container.innerHTML = html; 
}

export function listenForWins() { 
    if(!State.contracts.blackjack) return; 
    State.contracts.blackjack.on("GameFinished", (p, won, pay, dScore, pScore) => { 
        if(p == State.wallet.address) { 
            renderCards('bjDealer', dScore); 
            renderCards('bjPlayer', pScore); 
            showRes(pay, won ? "YOU WON!" : "DEALER WINS"); 
            const btn = document.getElementById('gameActionBtn');
            btn.disabled = false;
            btn.innerText = "PLAY AGAIN";
            State.game.isPlaying = false;
        } 
    }); 
}

// --- PARTNERS ---
export function unlockPartners() { 
    document.getElementById('partner-locked').classList.add('hidden'); 
    document.getElementById('partner-unlocked').classList.remove('hidden'); 
    document.getElementById('refLinkInput').value = `${window.location.origin}?ref=${State.wallet.address}`; 
}

export function copyRefLink() { 
    document.getElementById("refLinkInput").select(); 
    navigator.clipboard.writeText(document.getElementById("refLinkInput").value); 
    toast("LINK COPIED"); 
}

// --- NFT LOGIC ---
export async function mintNFT(id) { 
    if(!State.wallet.signer) return toast("CONNECT PICKAXE", "error"); 
    try { 
        const info = await State.contracts.nft.tierInfo(id); 
        const allow = await State.contracts.token.allowance(State.wallet.address, CONSTANTS.ADDR.NFT); 
        if(allow.lt(info.price)) await (await State.contracts.token.approve(CONSTANTS.ADDR.NFT, ethers.constants.MaxUint256)).wait(); 
        await (await State.contracts.nft.mint(id, 1)).wait(); 
        toast("HIRED MINER SUCCESSFULLY"); 
        loadUserData(); updateUI(); 
    } catch(e) { toast("HIRING FAILED", "error"); } 
}

export async function stakeNFT(id) { 
    try { 
        await (await State.contracts.nft.stake(id, 1)).wait(); 
        loadUserData(); 
        toast("MINER SENT TO VAULT"); 
    } catch(e){} 
}

export async function unstakeNFT(id) { 
    try { 
        await (await State.contracts.nft.unstake(id, 1)).wait(); 
        loadUserData(); 
        toast("MINER RETURNED"); 
    } catch(e){} 
}

export async function claimRewards() { 
    try { 
        await (await State.contracts.nft.claim()).wait(); 
        toast("GOLD COLLECTED"); 
        loadUserData(); 
    } catch(e){} 
}

export async function loadUserData() { 
    if(!State.wallet.signer) return; 
    const list = document.getElementById('inventory-list'); 
    list.innerHTML = ''; 
    let totalStaked = 0, dailyYield = 0; 
    const tiers = ["ROOKIE", "WORKER", "ENGINEER", "FOREMAN", "KING"]; 
    const rates = [50, 120, 350, 800, 2000]; 
    for(let i=0; i<5; i++) { 
        try { 
            const bal = await State.contracts.nft.balanceOf(State.wallet.address, i); 
            const staked = await State.contracts.nft.getStakedBalance(State.wallet.address, i); 
            totalStaked += parseInt(staked); 
            dailyYield += parseInt(staked) * rates[i]; 
            if(bal > 0) list.innerHTML += `<div class="flex justify-between bg-[#111] p-2 rounded mb-1 border-l-2 border-gray-600"><span class="text-xs text-white">${tiers[i]} (${bal})</span><button onclick="window.stakeNFT(${i})" class="text-[10px] bg-blue-900 px-2 rounded text-white hover:bg-blue-800">STAKE</button></div>`;
            if(staked > 0) list.innerHTML += `<div class="flex justify-between bg-green-900/20 p-2 rounded mb-1 border-l-2 border-primary"><span class="text-xs text-primary">${tiers[i]} (STAKED)</span><button onclick="window.unstakeNFT(${i})" class="text-[10px] bg-red-900 px-2 rounded text-white hover:bg-red-800">UNSTAKE</button></div>`;
        } catch(e) {} 
    } 
    document.getElementById('total-staked').innerText = totalStaked + " MINERS"; 
    document.getElementById('daily-yield').innerText = dailyYield + " PBJ/d"; 
    try { 
        const rew = await State.contracts.nft.getPendingRewards(State.wallet.address); 
        document.getElementById('pending-rewards').innerText = parseFloat(ethers.utils.formatUnits(rew, 18)).toFixed(2); 
    } catch(e) {} 
}

// --- TOKEN BUYING ---
export async function buyTokens() { 
    if(!State.wallet.signer) return alert("Connect Wallet"); 
    
    const ethVal = document.getElementById('buyInputETH').value;
    if (!ethVal || ethVal <= 0) return alert("Enter Amount");

    try { 
        const tx = await State.contracts.presale.buyTokens({
            value: ethers.utils.parseEther(ethVal)
        });
        await tx.wait(); 
        toast("TOKENS MINTED SUCCESSFULLY"); 
        updateUI(); 
    } catch(e) {
        console.error(e);
        toast("TRANSACTION FAILED", "error");
    } 
}
