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
        document.getElementById('headerBalance').innerText = fmt.toLocaleString(); 
        document.getElementById('modalBalance').innerText = fmt.toLocaleString(); 
        document.getElementById('walletDisplay').style.display = 'flex'; 

        // Balance ETH
        const ethBal = await State.wallet.signer.getBalance();
        const ethFmt = parseFloat(ethers.utils.formatEther(ethBal)).toFixed(4);
        document.getElementById('ethBalDisplay').innerText = ethFmt;
    } catch(e) {} 
}

// --- SET MAX BET ---
export function setMaxBet() { 
    if(!State.wallet.address) return; 
    document.getElementById('gameBetInput').value = State.wallet.balance; 
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

// --- GAME EXECUTION ---
async function executeGame(game) { 
    if(!State.wallet.signer) return toast("CONNECT PICKAXE", "error"); 
    if(State.game.isPlaying) return; 

    const betVal = document.getElementById('gameBetInput').value;
    if(parseFloat(betVal) <= 0) return toast("Invalid Amount", "error");
    if(parseFloat(betVal) > State.wallet.balance) return toast("Insufficient Balance", "error");

    const bet = ethers.utils.parseUnits(betVal, 18); 
    const btn = document.getElementById('gameActionBtn'); 
    
    try {
        State.game.isPlaying = true;
        btn.disabled = true; 
        btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> MINING...`; 
        
        // Approval check
        const spender = game === 'blackjack' ? CONSTANTS.ADDR.BLACKJACK : CONSTANTS.ADDR.INSTANT; 
        const allow = await State.contracts.token.allowance(State.wallet.address, spender); 
        if(allow.lt(bet)) {
            toast("Approving PBJ...", "info");
            const txApp = await State.contracts.token.approve(spender, ethers.constants.MaxUint256);
            await txApp.wait();
        }

        playSound('spin'); 
        const gasOptions = { gasLimit: 500000 }; 
        let tx; 

        // Game Switch
        switch(game) { 
            case 'slots': tx = await State.contracts.instant.playSlots(bet, gasOptions); break; 
            case 'blackjack': tx = await State.contracts.blackjack.placeBet(bet, gasOptions); break; 
            case 'roulette': tx = await State.contracts.instant.playRoulette(bet, window.rouletteChoice || 0, gasOptions); break; 
            case 'dice': tx = await State.contracts.instant.playDice(bet, 50, gasOptions); break; 
            case 'plinko': tx = await State.contracts.instant.playPlinko(bet, gasOptions); break; 
            case 'keno': tx = await State.contracts.instant.playKeno(bet, gasOptions); break; 
            case 'mines': tx = await State.contracts.instant.playMines(bet, 3, gasOptions); break; 
            case 'tower': tx = await State.contracts.instant.playTower(bet, window.towerDiff || 1, gasOptions); break; 
            case 'crash': 
                const mult = Math.floor(parseFloat(document.getElementById('crashOut').value) * 100); 
                tx = await State.contracts.instant.playCrash(bet, mult, gasOptions); 
                break; 
        } 
        
        if (game !== 'blackjack') startAnimation(game); 
        const receipt = await tx.wait(); 
        stopAnimation(); 
        
        if(game !== 'blackjack') { 
            const event = receipt.events.find(e => e.event); 
            if (event) { 
                const args = event.args; 
                if(game === 'dice') showRes(args.payout, `ROLLED: ${args.rolled}`, 'diceRes', args.rolled); 
                else if(game === 'slots') showRes(args.payout, `SYMBOLS: ${args.outcome.join('-')}`, 'slotRes', `<div class="flex gap-2"><div class="slot-reel">${emoji(args.outcome[0])}</div><div class="slot-reel">${emoji(args.outcome[1])}</div><div class="slot-reel">${emoji(args.outcome[2])}</div></div>`); 
                else if(game === 'roulette') showRes(args.payout, `RESULT: ${args.roll}`, 'rouletteRes', args.roll); 
                else if(game === 'plinko') showRes(args.payout, `BUCKET: ${args.slot}`, 'plinkoRes', `BIN ${args.slot}`); 
                else if(game === 'keno') showRes(args.payout, `MATCHES: ${args.matches}`, 'kenoRes', `${args.matches} HITS`); 
                else if(game === 'mines') { 
                    showRes(args.payout, args.exploded ? "BOOM" : "SAFE"); 
                    const cells = document.querySelectorAll('.mine-cell'); 
                    cells.forEach(c => { c.className = args.exploded ? "mine-cell boom" : "mine-cell safe"; c.innerText = args.exploded ? "💣" : "💎"; }); 
                } else if(game === 'tower') showRes(args.payout, `LEVEL: ${args.levelReached}`, 'towerRes', `LVL ${args.levelReached}`); 
                else if(game === 'crash') { const c = (args.crashPoint/100).toFixed(2); showRes(args.payout, `CRASHED @ ${c}x`, 'crashRes', c+"x"); } 
            } 
        } else { 
            document.getElementById('gameStatus').innerText = "WAITING FOR DEALER..."; 
        } 
    } catch(e) { 
        console.error(e); 
        stopAnimation(); 
        document.getElementById('gameStatus').innerText = "TX FAILED"; 
        toast("TX Failed or Rejected", "error"); 
    } finally {
        if(game !== 'blackjack') {
            btn.disabled = false;
            btn.innerText = "START MINE";
            State.game.isPlaying = false;
        }
    }
}

// --- HELPERS ---
function emoji(num) { return ['💎','⛏️','💰','🔦','🐸','🪙','7️⃣'][num] || num; }

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
