import { State, gameData } from './state.js';

// --- ATMOSPHERE & VISUAL EFFECTS ---
export function initAtmosphere() {
    const dustContainer = document.getElementById('dust-container');
    const torch = document.getElementById('torch');
    
    // Increased Dust Particles
    for (let i = 0; i < 40; i++) {
        const d = document.createElement('div');
        d.classList.add('dust');
        d.style.left = Math.random() * 100 + 'vw';
        d.style.top = Math.random() * 100 + 'vh';
        d.style.animationDuration = (Math.random() * 10 + 5) + 's';
        d.style.opacity = Math.random() * 0.6 + 0.2; // Higher opacity range
        dustContainer.appendChild(d);
    }

    // Torch Effect
    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        torch.style.setProperty('--x', x + '%');
        torch.style.setProperty('--y', y + '%');
    });
}

// --- MOBILE MENU ---
export function closeMobileMenu() {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('mobileMenuOverlay').classList.add('hidden');
}

export function openMobileMenu() {
    const sb = document.getElementById('sidebar');
    sb.classList.remove('hidden');
    sb.classList.add('absolute', 'z-40', 'h-full');
    document.getElementById('mobileMenuOverlay').classList.remove('hidden');
}

// --- AUTH MODAL LOGIC ---
export function toggleAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.toggle('hidden');
    modal.classList.toggle('flex');
}

export function switchAuthTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if(tab === 'login') tabs[0].classList.add('active');
    else tabs[1].classList.add('active');
}

// --- SWAP TAB LOGIC ---
export function switchSwapTab(tab) {
    const buyTab = document.getElementById('tabBuy');
    const sellTab = document.getElementById('tabSell');
    const buySec = document.getElementById('swapBuy');
    const sellSec = document.getElementById('swapSell');

    if (tab === 'buy') {
        buyTab.classList.add('active');
        sellTab.classList.remove('active');
        buySec.classList.remove('hidden');
        sellSec.classList.add('hidden');
        sellSec.classList.remove('flex');
    } else {
        sellTab.classList.add('active');
        buyTab.classList.remove('active');
        buySec.classList.add('hidden');
        sellSec.classList.remove('hidden');
        sellSec.classList.add('flex');
    }
}

// --- TOAST NOTIFICATIONS ---
export function toast(msg, type='success') { 
    const c = document.getElementById('toast-container'); 
    const t = document.createElement('div'); 
    const color = type === 'error' ? 'bg-red-900/90 border-red-500' : 'bg-black/90 border-primary'; 
    t.className = `px-4 py-3 text-xs font-mono uppercase text-white border-l-4 shadow-lg mb-2 rounded backdrop-blur-md transform transition-all duration-300 translate-x-10 opacity-0 ${color}`; 
    t.innerHTML = `<strong>> SYSTEM:</strong> ${msg}`; 
    c.appendChild(t); 
    requestAnimationFrame(() => t.classList.remove('translate-x-10', 'opacity-0'));
    setTimeout(() => { t.classList.add('opacity-0'); setTimeout(() => t.remove(), 300); }, 3000); 
}

// --- SOUND EFFECTS ---
export function playSound(id) { 
    if(State.settings.muted) return; 
    const el = document.getElementById(`sfx-${id}`); 
    if(el) { el.volume = 0.3; el.currentTime = 0; el.play().catch(()=>{}); } 
}

// --- CHAT SYSTEM ---
const chatUsers = ['PepeKing', 'ElonMuskrat', 'Digger88', 'GoldFever', 'SatoshiN', 'MoonBoy', 'WhaleAlert', 'DiamondHands', 'Miner69'];
const userColors = ['text-blue-400', 'text-red-400', 'text-purple-400', 'text-yellow-400', 'text-green-400'];
const msgs = ['LFG!', 'Green rain?', 'Just rekt on mines', 'WAGMI', 'Pepe to moon', 'Any luck on slots?', 'Need more PBJ', 'Hold the line', 'Nice win @Digger88', 'Gas is low rn'];

export function toggleChat() {
    const sb = document.getElementById('chatSidebar');
    sb.classList.toggle('hidden');
    sb.classList.toggle('flex');
}

export function addChatMessage(user, msg, type = 'user') {
    const chatContainer = document.getElementById('chatContainer');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    let color = type === 'user' ? userColors[Math.floor(Math.random() * userColors.length)] : (type === 'mod' ? 'text-primary' : 'text-gold');
    div.innerHTML = `<div><span class="chat-user ${color}">${user}:</span> <span class="text-gray-300 bg-[#151515] px-2 py-0.5 rounded text-xs">${msg}</span></div>`;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

export function sendChat() {
    const input = document.getElementById('chatInput');
    if(!input.value.trim()) return;
    if(!State.wallet.address) return toast("Login to chat", "error");
    addChatMessage(State.user?.username || 'You', input.value, 'user');
    input.value = '';
}

export function handleChatKey(e) { 
    if(e.key === 'Enter') sendChat(); 
}

// Fake Chat Bot (Slower: 10-25s)
export function startChatLoop() {
    function chatLoop() {
        const delay = Math.floor(Math.random() * 15000) + 10000; // 10000ms to 25000ms
        setTimeout(() => {
            const u = chatUsers[Math.floor(Math.random()*chatUsers.length)];
            const m = msgs[Math.floor(Math.random()*msgs.length)];
            addChatMessage(u, m);
            chatLoop();
        }, delay);
    }
    chatLoop();
}

// --- LIVE FEED ---
export function addFeedRow(game, user, bet, mult, payout) {
    const liveBody = document.getElementById('liveFeedBody');
    const tr = document.createElement('tr');
    tr.className = 'animate-slide-in';
    const won = parseFloat(payout) > 0;
    const gData = gameData[game] || { icon: '🎮', img: '' };
    
    tr.innerHTML = `
        <td class="flex items-center">
            <img src="${gData.img}" class="game-thumb" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
            <span class="text-lg hidden">${gData.icon}</span> 
            <span class="ml-1">${game}</span>
        </td>
        <td><span class="text-xs text-primary font-mono">${user}</span></td>
        <td><span class="text-white font-bold">${bet}</span></td>
        <td><span class="${won ? 'text-white' : 'text-gray-600'}">${mult}</span></td>
        <td>${won ? `<span class="win-text">+${payout}</span>` : '<span class="text-gray-700">-</span>'}</td>
    `;
    liveBody.insertBefore(tr, liveBody.firstChild);
    if(liveBody.children.length > 6) liveBody.removeChild(liveBody.lastChild);
}

// Fake Feed Activity
export function startLiveFeed() {
    setInterval(() => {
        const g = Object.keys(gameData)[Math.floor(Math.random()*Object.keys(gameData).length)];
        const u = '0x...' + Math.floor(Math.random()*999);
        const b = Math.floor(Math.random()*1000);
        const w = Math.random() > 0.6;
        addFeedRow(g, u, b, w ? (Math.random()*5).toFixed(2)+'x' : '0.00x', w ? (b*2).toFixed(0) : 0);
    }, 2500); // Slightly slower for better readability
}

// --- TIMERS ---
export function initTimers() {
    // Presale timer
    let target = localStorage.getItem('pEnd') || Date.now() + (5 * 24 * 3600 * 1000); 
    localStorage.setItem('pEnd', target);
    setInterval(() => { 
        const d = target - Date.now(); 
        if(d>0) { 
            document.getElementById('d').innerText = Math.floor(d/86400000); 
            document.getElementById('h').innerText = Math.floor((d%86400000)/3600000); 
            document.getElementById('m').innerText = Math.floor((d%3600000)/60000); 
        } 
    }, 1000);
    
    // Bonus timer
    let bonusTarget = localStorage.getItem('bEnd') || Date.now() + (2 * 3600 * 1000); 
    localStorage.setItem('bEnd', bonusTarget);
    setInterval(() => { 
        let diff = bonusTarget - Date.now(); 
        if(diff <= 0) { 
            bonusTarget = Date.now() + (2 * 3600 * 1000); 
            localStorage.setItem('bEnd', bonusTarget); 
        } 
        const h = Math.floor((diff % 86400000) / 3600000); 
        const m = Math.floor((diff % 3600000) / 60000); 
        const s = Math.floor((diff % 60000) / 1000); 
        document.getElementById('bonusTimer').innerText = `0${h}:${m<10?'0'+m:m}:${s<10?'0'+s:s}`; 
    }, 1000);
}

// --- BALANCE ANIMATION ---
export function animateWinToBalance(amount) { 
    const startEl = document.getElementById('innerGameContent'); 
    const endEl = document.getElementById('headerBalance'); 
    if(!startEl || !endEl) return; 
    const rectStart = startEl.getBoundingClientRect(); 
    const rectEnd = endEl.getBoundingClientRect(); 
    
    const flyer = document.createElement('div'); 
    flyer.classList.add('fly-money'); 
    flyer.innerText = `+${amount.toLocaleString()}`; 
    flyer.style.left = `${rectStart.left + rectStart.width/2 - 30}px`; 
    flyer.style.top = `${rectStart.top + rectStart.height/2}px`; 
    document.body.appendChild(flyer); 
    
    requestAnimationFrame(() => { 
        flyer.style.left = `${rectEnd.left}px`; 
        flyer.style.top = `${rectEnd.top}px`; 
        flyer.style.opacity = '0'; 
        flyer.style.transform = 'scale(0.5)'; 
    }); 
    
    setTimeout(() => { 
        flyer.remove(); 
    }, 1200); 
}

// --- GAME ANIMATIONS ---
export function startAnimation(game) { 
    if(State.game.animInterval) clearInterval(State.game.animInterval); 
    const status = document.getElementById('gameStatus'); 
    status.innerText = "EXCAVATING..."; 
    status.className = "bg-black py-2 text-center text-xs font-mono uppercase tracking-widest text-primary animate-pulse"; 
    
    if (game === 'slots') { 
        const emojis = ['💎','⛏️','💰','🔦','🐸','🪙','7️⃣']; 
        const el = document.getElementById('slotRes'); 
        el.classList.add('blur-anim'); 
        State.game.animInterval = setInterval(() => { 
            const r = () => emojis[Math.floor(Math.random()*7)]; 
            el.innerHTML = `<div class="flex gap-2"><div class="slot-reel">${r()}</div><div class="slot-reel">${r()}</div><div class="slot-reel">${r()}</div></div>`; 
        }, 60); 
    } else if (game === 'dice') { 
        const el = document.getElementById('diceRes'); 
        el.classList.add('shaking'); 
        State.game.animInterval = setInterval(() => { el.innerText = Math.floor(Math.random() * 100); }, 30); 
    } else if (game === 'crash') { 
        const el = document.getElementById('crashRes'); 
        let val = 1.00; 
        State.game.animInterval = setInterval(() => { val += 0.05; el.innerText = val.toFixed(2) + "x"; el.style.color = "#39FF14"; }, 100); 
    } else if (game === 'roulette') { 
        const el = document.getElementById('rouletteRes'); 
        const colors = ['text-red-500', 'text-white']; 
        el.classList.add('shaking'); 
        State.game.animInterval = setInterval(() => { 
            el.innerText = Math.floor(Math.random() * 37); 
            el.className = `text-6xl font-bold mb-2 ${colors[Math.floor(Math.random()*2)]}`; 
        }, 80); 
    } 
}

export function stopAnimation() { 
    if(State.game.animInterval) clearInterval(State.game.animInterval); 
    const els = document.querySelectorAll('.blur-anim, .shaking'); 
    els.forEach(e => e.classList.remove('blur-anim', 'shaking')); 
}
