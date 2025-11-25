// --- GAME CONSTANTS ---
export const CONSTANTS = {
    CHAIN_ID_HEX: '0x2105', // 8453 (Base Mainnet)
    CHAIN_ID_DEC: 8453,
    ADDR: { 
        TOKEN: "0xff4b4f2076F39550e2C5fD44cb2024Eb06B944E5", 
        PRESALE: "0xff4b4f2076F39550e2C5fD44cb2024Eb06B944E5", 
        BLACKJACK: "0xbe0b8099B707e3c0bA278583C6b5561D82E77f3E", 
        INSTANT: "0xbcF9DFfcDaDeC818F7B653aF1a7Ff287F3e7011f", 
        NFT: "0xDE05dAf2cbF59ce9094979d639393ADED494e920" 
    }
};

export const ABIS = { 
    TOKEN: [ "function approve(address, uint256) external returns (bool)", "function balanceOf(address) external view returns (uint256)", "function allowance(address, address) external view returns (uint256)" ], 
    PRESALE: [ "function buyTokens() payable" ], 
    BLACKJACK: [ "function placeBet(uint256 amount) external", "event GameFinished(address indexed player, bool won, uint256 payout, uint256 dealerScore, uint256 playerScore)" ], 
    INSTANT: [ "function playSlots(uint256 _bet) external", "function playRoulette(uint256 _bet, uint256 _choice) external", "function playDice(uint256 _bet, uint256 _rollUnder) external", "function playPlinko(uint256 _bet) external", "function playCrash(uint256 _bet, uint256 _cashoutX) external", "function playMines(uint256 _bet, uint256 _minesCount) external", "function playKeno(uint256 _bet) external", "function playTower(uint256 _bet, uint256 _difficulty) external", "event SlotsPlayed(address indexed player, uint256 bet, uint256 payout, uint256[3] outcome)", "event RoulettePlayed(address indexed player, uint256 bet, uint256 payout, uint256 roll, string color)", "event DicePlayed(address indexed player, uint256 bet, uint256 payout, uint256 rolled, uint256 prediction)", "event PlinkoPlayed(address indexed player, uint256 bet, uint256 payout, uint256 slot)", "event CrashPlayed(address indexed player, uint256 bet, uint256 payout, uint256 crashPoint, uint256 cashoutPoint)", "event MinesPlayed(address indexed player, uint256 bet, uint256 payout, bool exploded)", "event KenoPlayed(address indexed player, uint256 bet, uint256 payout, uint256 matches)", "event TowerPlayed(address indexed player, uint256 bet, uint256 payout, uint256 levelReached)" ], 
    NFT: [ "function mint(uint256, uint256) external", "function stake(uint256, uint256) external", "function unstake(uint256, uint256) external", "function claim() external", "function getPendingRewards(address) view returns (uint256)", "function getStakedBalance(address, uint256) view returns (uint256)", "function balanceOf(address, uint256) view returns (uint256)", "function tierInfo(uint256) view returns (uint256 price, uint256 rewardPerSec, bool active)" ] 
};

export const TUTORIALS = { 
    'slots': { t: 'GEM SLOTS', d: 'Match 3 gems to win big! RTP: 96%. Rare diamonds pay 10x.' }, 
    'blackjack': { t: 'CAVE BLACKJACK', d: 'Beat the dealer to 21 without busting. Strategy matters! RTP: 99.5%.' }, 
    'roulette': { t: 'DRILL ROULETTE', d: 'Predict Red or Black. Simple 2x payout. RTP: 97.3%.' }, 
    'dice': { t: 'DICE', d: 'Roll under 50 to double your money. Provably Fair. RTP: 98%.' }, 
    'mines': { t: 'MINEFIELD', d: 'Avoid the 3 hidden dynamites. The more you reveal, the more you win. RTP: 97%.' }, 
    'tower': { t: 'MINE SHAFT', d: 'Climb the tower levels. Higher risk = Higher reward. RTP: 96%.' }, 
    'crash': { t: 'ROCKET CART', d: 'Cash out before the cart crashes! Multipliers can go 100x+. RTP: 95%.' }, 
    'plinko': { t: 'GEM DROP', d: 'Drop the ball and watch it fall into a multiplier slot. RTP: 97%.' }, 
    'keno': { t: 'ORE SCANNER', d: 'Match random numbers. 4 matches = 20x Payout. RTP: 94%.' } 
};

export const EXCHANGE_RATE = 1000000;

// --- STATE MANAGEMENT ---
export const State = {
    wallet: { provider: null, signer: null, address: null, balance: 0, ethBalance: 0 },
    contracts: {},
    game: { current: null, isPlaying: false, animInterval: null },
    settings: { muted: false },
    user: null
};

// Game data for live feed
export const gameData = { 
    'Crash': { icon: '🚀', img: 'assets/img/game-crash.png' }, 
    'Mines': { icon: '💣', img: 'assets/img/game-mines.png' }, 
    'Slots': { icon: '🎰', img: 'assets/img/game-slots.png' }, 
    'Blackjack': { icon: '🃏', img: 'assets/img/game-blackjack.png' },
    'Plinko': { icon: '🎯', img: 'assets/img/game-plinko.png' },
    'Roulette': { icon: '🎡', img: 'assets/img/game-roulette.png' }
};
