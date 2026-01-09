
export const COLORS = ["red","green","blue","yellow","white"];

export function createDeck() {
  const deck = [];
  let id = 1;
  for (const color of COLORS) {
    for (let v = 2; v <= 10; v++) deck.push({ id: id++, type:"number", value:v, color });
    for (let i = 0; i < 3; i++) deck.push({ id: id++, type:"wager", color });
  }
  return deck;
}

export function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

export function createGame() {
  const deck = createDeck();
  shuffle(deck);
  return {
    players: [
      { hand: deck.splice(-8), expeditions: initExp() },
      { hand: deck.splice(-8), expeditions: initExp() }
    ],
    discard: initDiscard(),
    deck,
    active: 0,
    phase: "play",
    finished: false
  };
}

function initExp() {
  return { red:[], green:[], blue:[], yellow:[], white:[] };
}
function initDiscard() {
  return { red:[], green:[], blue:[], yellow:[], white:[] };
}

export function canPlay(card, pile) {
  if (!pile.length) return true;
  const top = pile[pile.length-1];
  if (top.type === "wager") return card.type !== "wager";
  if (card.type === "wager") return false;
  return card.value >= top.value;
}

export function applyAction(game, pid, action) {
  if (game.finished) return;
  if (pid !== game.active) return;

  const player = game.players[pid];

  if (game.phase === "play") {
    const idx = player.hand.findIndex(c => c.id === action.cardId);
    if (idx === -1) return;
    const card = player.hand[idx];

    if (action.type === "play") {
      const pile = player.expeditions[card.color];
      if (!canPlay(card, pile)) return;
      pile.push(card);
    } else {
      game.discard[card.color].push(card);
    }
    player.hand.splice(idx,1);
    game.phase = "draw";
  } 
  else if (game.phase === "draw") {
    if (action.type === "deck") {
      if (!game.deck.length) { game.finished = true; return; }
      player.hand.push(game.deck.pop());
    } else {
      const pile = game.discard[action.color];
      if (!pile.length) return;
      player.hand.push(pile.pop());
    }
    game.phase = "play";
    game.active = 1 - pid;
    if (!game.deck.length) game.finished = true;
  }
}

export function viewFor(game, pid) {
  const g = JSON.parse(JSON.stringify(game));
  g.players = g.players.map((p,i)=>({
    expeditions: p.expeditions,
    hand: i===pid ? p.hand : p.hand.map(_=>({hidden:true}))
  }));
  return g;
}
