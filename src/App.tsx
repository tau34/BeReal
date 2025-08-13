import { useEffect, useState } from "react";

// BeReal - App.tsx (Vite + React + TypeScript + Tailwind)
// Default export a React component. Tailwind classes are used for styling.

type ComplexCard = {
  id: string;
  a: number;
  b: number; // imaginary coefficient
  kind: "complex";
};

type BinaryOpCard = {
  id: string;
  op: "+" | "-" | "×";
  kind: "binary";
};

type UnaryOpCard = {
  id: string;
  op: "conj" | "×i" | "×(-i)";
  kind: "unary";
};

type Card = ComplexCard | BinaryOpCard | UnaryOpCard;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function complexToStr(a: number, b: number) {
  if (b === 0) return `${a}`;
  if (a === 0) return `${b === 1 ? "" : b === -1 ? "-" : b}i`;
  const sign = b >= 0 ? "+" : "-";
  const bb = Math.abs(b);
  return `${a} ${sign} ${bb === 1 ? "" : bb}i`;
}

function add(z1: ComplexCard, z2: ComplexCard): ComplexCard {
  return { id: uid("c"), kind: "complex", a: z1.a + z2.a, b: z1.b + z2.b };
}
function sub(z1: ComplexCard, z2: ComplexCard): ComplexCard {
  return { id: uid("c"), kind: "complex", a: z1.a - z2.a, b: z1.b - z2.b };
}
function mul(z1: ComplexCard, z2: ComplexCard): ComplexCard {
  // (a+bi)(c+di) = (ac - bd) + (ad + bc)i
  const a = z1.a * z2.a - z1.b * z2.b;
  const b = z1.a * z2.b + z1.b * z2.a;
  return { id: uid("c"), kind: "complex", a, b };
}

function conj(z: ComplexCard): ComplexCard {
  return { id: uid("c"), kind: "complex", a: z.a, b: -z.b };
}
function imul(z: ComplexCard, sign = 1): ComplexCard {
  // i*(a+bi) = -b + ai. sign = 1 for i, -1 for -i
  const a = -sign * z.b;
  const b = sign * z.a;
  return { id: uid("c"), kind: "complex", a, b };
}

function isReal(c: ComplexCard) {
  return c.b === 0;
}

export default function App() {
  // settings
  const COMPLEX_RANGE = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
  const COMPLEX_RANGE_NON0 = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

  // Board = complex numbers on the board we want to clear
  const [board, setBoard] = useState<ComplexCard[]>(genInitialBoard(6));
  // Hand = the 8-card hand (2 binary, 4 complex, 2 unary)
  const [hand, setHand] = useState<Card[]>([]);
  const [stock, setStock] = useState<Card | null>(null);

  // selected operation (must come from hand)
  const [selectedOp, setSelectedOp] = useState<Card | null>(null);
  // selected targets: array of card ids (can refer to board or hand complex cards)
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [totalRemoved, setTotalRemoved] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  function sample<T>(arr: T[]) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function genComplex(): ComplexCard {
    const a = sample(COMPLEX_RANGE);
    const b = sample(COMPLEX_RANGE);
    return { id: uid("c"), kind: "complex", a, b };
  }

  function genNonRealComplex(): ComplexCard {
    const a = sample(COMPLEX_RANGE);
    const b = sample(COMPLEX_RANGE_NON0);
    return { id: uid("c"), kind: "complex", a, b };
  }

  function genBinary(): BinaryOpCard {
    const ops: BinaryOpCard["op"][] = ["+", "-", "×"];
    return { id: uid("b"), kind: "binary", op: sample(ops) };
  }
  function genUnary(): UnaryOpCard {
    const ops: UnaryOpCard["op"][] = ["conj", "×i", "×(-i)"];
    return { id: uid("u"), kind: "unary", op: sample(ops) };
  }

  function genHandBatch(): Card[] {
    const cards: Card[] = [];
    // 2 binary
    for (let i = 0; i < 2; i++) cards.push(genBinary());
    // 4 complex (hand constants)
    for (let i = 0; i < 4; i++) cards.push(genComplex());
    // 2 unary
    for (let i = 0; i < 2; i++) cards.push(genUnary());
    // shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  function genInitialBoard(n = 6): ComplexCard[] {
    const arr: ComplexCard[] = [];
    for (let i = 0; i < n; i++) arr.push(genNonRealComplex());
    return arr;
  }

  useEffect(() => {
    // initial setup
    setHand(genHandBatch());
    setMoves(0);
    setTotalRemoved(0);
    setSelectedOp(null);
    setSelectedTargets([]);
    setStock(null);
    setGameOver(false);
  }, []);

  useEffect(() => {
    // check win: all complex numbers on board removed
    if (board.length === 0 && !gameOver) {
      console.log("Game over! All cleared.");
      setGameOver(true);
    }
  }, [board, gameOver]);

  function resetSelections() {
    setSelectedOp(null);
    setSelectedTargets([]);
  }

  function findCardById(id: string): Card | ComplexCard | undefined {
    // search hand then board
    const fromHand = hand.find((c) => c.id === id);
    if (fromHand) return fromHand;
    const fromBoard = board.find((c) => c.id === id);
    if (fromBoard) return fromBoard;
    return stock && stock.id === id ? stock : undefined;
  }

  function onSelectCard(id: string) {
    const card = findCardById(id);
    if (!card) return;

    // If card is in hand and is an op, select operation
    const isOnBoard = board.find((c) => c.id === id);

    if (card.kind === "binary" || card.kind === "unary") {
      setSelectedOp(card);
      setSelectedTargets([]);
      return;
    }

    // Otherwise, card is a complex (either from board or hand) and we treat it as a target
    if (card.kind !== "complex") return; // guards

    // If no op selected, toggle selection (so player can preselect two board numbers without picking op first)
    if (!selectedOp) {
      if (!isOnBoard) {
        setSelectedTargets((prev) => {
          if (prev.includes(id)) return prev.filter((x) => x !== id);
          return [...prev, id].slice(-2);
        });
      }
      return;
    }

    // If an op selected:
    if (selectedOp.kind === "unary") {
      // unary requires one board target (we only allow unary on board)
      // ensure target is on board
      if (!isOnBoard) {
        // unary only acts on board numbers
        return;
      }
      performUnary(selectedOp as UnaryOpCard, isOnBoard as ComplexCard);
      return;
    } else {
      // binary: needs two targets; the first can be from board, the second can be from board or hand complex (hand complex acts as constant).
      // If we already have one selected, use that + this (if distinct)
      if (selectedTargets.length === 0 && !isOnBoard) {
        setSelectedTargets([id]);
        return;
      } else if (selectedTargets.length === 1) {
        const firstId = selectedTargets[0];
        if (firstId === id) return; // cannot pick same twice
        const firstCard = findCardById(firstId);
        const secondCard = card;
        if (!firstCard || !secondCard) return;
        // both must be complex
        if (firstCard.kind !== "complex" || secondCard.kind !== "complex") {
          resetSelections();
          return;
        }
        // perform binary: note that one or both may be on board or hand
        // We'll prefer to treat the *left* operand as the one on board if possible (so results update board element).
        performBinary(selectedOp as BinaryOpCard, firstCard as ComplexCard, secondCard as ComplexCard, firstId, id);
        return;
      } else {
        resetSelections();
      }
    }
  }

  function performUnary(opCard: UnaryOpCard, target: ComplexCard) {
    const idx = board.findIndex((c) => c.id === target.id);
    if (idx === -1) return; // unary only on board
    let result = target;
    if (opCard.op === "conj") result = conj(target);
    else if (opCard.op === "×i") result = imul(target, 1);
    else result = imul(target, -1);
    setMoves((m) => m + 1);

    if (isReal(result)) {
      // remove target from board
      setBoard((prev) => {
        const copy = [...prev];
        copy.splice(idx, 1);
        return copy;
      });
      setTotalRemoved((t) => t + 1);
    } else {
      // replace target with result
      setBoard((prev) => {
        const copy = [...prev];
        copy[idx] = result;
        return copy;
      });
    }

    resetSelections();
    drawNextBatch();
    if (stock && opCard.id === stock.id) {
      setStock(null);
    }
  }

  /**
   * performBinary:
   * - opCard from hand
   * - z1 and z2 are ComplexCard objects (may come from board or hand)
   * - id1 and id2 are their ids (so we can detect whether they are on board)
   *
   * Behavior:
   * - If both operands are on board -> replace first with result (or remove both if becomes real), remove second accordingly.
   * - If one operand is on board and the other is from hand -> update only the board operand (replace or remove). Hand complex is NOT consumed.
   */
  function performBinary(
    opCard: BinaryOpCard,
    z1: ComplexCard,
    z2: ComplexCard,
    id1: string,
    id2: string
  ) {
    // determine presence on board
    const onBoard1 = board.findIndex((c) => c.id === id1) !== -1;
    const onBoard2 = board.findIndex((c) => c.id === id2) !== -1;

    // choose left operand as the board one if possible (so result updates board element).
    let left: ComplexCard = z1;
    let right: ComplexCard = z2;
    let leftIsBoard = onBoard1;
    let rightIsBoard = onBoard2;

    if (!leftIsBoard && rightIsBoard) {
      // swap so left is the board one
      left = z2;
      right = z1;
      leftIsBoard = rightIsBoard;
      rightIsBoard = onBoard1;
    }

    // if neither is on board (both hand) -> nothing to apply (do nothing)
    if (!leftIsBoard) {
      resetSelections();
      return;
    }

    let result: ComplexCard;
    if (opCard.op === "+") result = add(left, right);
    else if (opCard.op === "-") result = sub(left, right);
    else result = mul(left, right);

    setMoves((m) => m + 1);

    if (isReal(result)) {
      // If both operands were on board, remove both from board.
      if (leftIsBoard && rightIsBoard) {
        setBoard((prev) => prev.filter((c) => c.id !== left.id && c.id !== right.id));
        setTotalRemoved((t) => t + 2);
      } else {
        // only left (board) is affected -> remove it
        setBoard((prev) => prev.filter((c) => c.id !== left.id));
        setTotalRemoved((t) => t + 1);
      }
    } else {
      // not real: if left is on board, replace that board card with result; if right was also on board, remove the other
      setBoard((prev) => {
        const copy = [...prev];
        const li = copy.findIndex((c) => c.id === left.id);
        if (li === -1) return copy;
        copy[li] = result;
        // if right was on board and its id differs from left, remove it
        if (rightIsBoard && right.id !== left.id) {
          const ri = copy.findIndex((c) => c.id === right.id);
          if (ri !== -1) {
            copy.splice(ri, 1);
          }
        }
        return copy;
      });
      // when result stays, only one board card effectively changed (right hand constant not consumed)
      if (rightIsBoard && right.id !== left.id) {
        setTotalRemoved((t) => t + 1); // removed one board card
      } else {
        // no board card removed (just replaced)
      }
    }

    if (stock && id1 === stock.id) {
      setStock(null);
    }
    resetSelections();
    drawNextBatch();
  }

  // draw next 8 cards (replace hand)
  function drawNextBatch() {
    const batch = genHandBatch();
    setHand(batch);
    // clear selections
    resetSelections();
  }

  // stock operations are for hand cards only (spec: "手札のうち1枚をストックに置く")
  function toggleStockFromHand(cardId: string) {
    const cardInHand = hand.find((c) => c.id === cardId);
    if (!cardInHand) return;
    // if same card already in stock -> unstock (move back to hand)
    if (stock && stock.id === cardInHand.id) {
      setStock(null);
      return;
    }
    if (!stock) {
      // move this card into stock (remove from hand)
      setHand((prev) => prev.filter((c) => c.id !== cardId));
      setStock(cardInHand);
    } else {
      // swap: put current stock back to hand and take this one into stock
      setHand((prev) => {
        // remove selected card from hand and add previous stock
        const filtered = prev.filter((c) => c.id !== cardId);
        return [...filtered, stock];
      });
      setStock(cardInHand);
    }
    // clear selections if needed
    resetSelections();
  }

  function placeStockBack() {
    if (!stock) return;
    setHand((prev) => [...prev, stock]);
    setStock(null);
  }

  function resetGame() {
    setBoard(genInitialBoard(6));
    setHand(genHandBatch());
    setStock(null);
    setSelectedOp(null);
    setSelectedTargets([]);
    setMoves(0);
    setTotalRemoved(0);
    setGameOver(false);
  }

  const complexCount = board.length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">BeReal</h1>
          <div className="text-right">
            <div>Moves: <strong>{moves}</strong></div>
            <div>Remaining complex: <strong>{complexCount}</strong></div>
            <div>Removed: <strong>{totalRemoved}</strong></div>
          </div>
        </header>

        <section className="mb-4">
          <div className="flex gap-4 items-center">
            <button
              className="px-3 py-2 bg-blue-600 text-white rounded shadow"
              onClick={drawNextBatch}
            >
              Draw next 8 cards
            </button>
            <button className="px-3 py-2 bg-gray-200 rounded" onClick={placeStockBack}>
              Place stock back
            </button>
            <button className="px-3 py-2 bg-red-500 text-white rounded" onClick={resetGame}>
              Reset
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            手札の演算で盤上や手札の数字を計算して、結果が実数ならその駒は消えます。
          </div>
        </section>

        <section className="mb-6">
          <h2 className="font-semibold mb-2">Board (clear these)</h2>
          <div className="grid grid-cols-6 gap-3 mb-4">
            {board.map((c) => (
              <div key={c.id}>
                <CardView
                  card={c}
                  onClick={() => onSelectCard(c.id)}
                  selected={selectedTargets.includes(c.id) || selectedOp?.id === c.id}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-48 p-3 bg-white rounded shadow">
              <h2 className="font-semibold mb-2">Stock</h2>
              {stock ? (
                <CardView card={stock} onClick={() => onSelectCard(stock.id)} 
                  selected={selectedOp?.id === stock.id || selectedTargets.includes(stock.id)}
                />
              ) : (
                <div className="text-gray-400">empty</div>
              )}
              <div className="mt-3">
                <div className="text-sm text-gray-600 mb-2">Put one hand card into stock</div>
              </div>
            </div>

            <div className="flex-1">
              <h2 className="font-semibold mb-2">Hand (8 cards)</h2>
              <div className="grid grid-cols-4 gap-3">
                {hand.map((card) => (
                  <div key={card.id}>
                    <CardView
                      card={card}
                      onClick={() => {
                        // if operator clicked (binary/unary) -> select op
                        // if complex in hand clicked -> toggle as target (allowed)
                        onSelectCard(card.id);
                      }}
                      selected={selectedOp?.id === card.id || selectedTargets.includes(card.id)}
                    />
                    <div className="mt-1 flex gap-1">
                      <button
                        className="text-xs px-2 py-1 bg-gray-100 rounded"
                        onClick={() => toggleStockFromHand(card.id)}
                      >
                        {stock && stock.id === card.id ? "Unstock" : "Stock"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-2">Selected</h2>
          <div className="flex gap-3 items-center">
            <div className="p-3 bg-white rounded shadow min-w-[220px]">
              <div className="text-sm text-gray-600">Operation</div>
              <div className="mt-1">{selectedOp ? renderOp(selectedOp) : <span className="text-gray-400">none</span>}</div>
            </div>
            <div className="p-3 bg-white rounded shadow min-w-[220px]">
              <div className="text-sm text-gray-600">Targets</div>
              <div className="mt-1">
                {selectedTargets.length === 0 ? (
                  <span className="text-gray-400">none</span>
                ) : (
                  selectedTargets.map((id) => {
                    const c = findCardById(id) as Card | undefined;
                    if (!c || c.kind !== "complex") {return null;}
                    return (
                      <div key={id} className="text-sm font-mono">
                        {complexToStr(c.a, c.b)} {board.find((x) => x.id === id) ? "(board)" : "(hand)"}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex-1 text-right">
              <div className="inline-block p-3 bg-white rounded shadow">
                <div>Moves: <strong>{moves}</strong></div>
                <div>Complex remaining: <strong>{complexCount}</strong></div>
              </div>
            </div>
          </div>
        </section>

        {gameOver && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
            <h3 className="font-bold">All cleared in {moves} moves! 🎉</h3>
            <p>You cleared all board complex numbers in <strong>{moves}</strong> moves.</p>
            <p>Reset to start again.</p>
          </div>
        )}

        <footer className="mt-8 text-sm text-gray-500">BeReal</footer>
      </div>
    </div>
  );
}

function renderOp(card: Card) {
  if (card.kind === "binary") return <div className="text-xl font-mono">{card.op}</div>;
  if (card.kind === "unary") return <div className="text-lg font-mono">{card.op}</div>;
  return null;
}

function CardView({ card, onClick, selected }: { card: Card; onClick: () => void; selected: boolean }) {
  const base = "p-3 rounded border cursor-pointer select-none";
  const cls = selected ? `${base} border-blue-500 bg-blue-50` : `${base} border-gray-200 bg-white`;

  if (card.kind === "complex") {
    return (
      <div className={cls} onClick={onClick}>
        <div className="text-sm text-gray-500">Complex</div>
        <div className="mt-1 text-lg font-mono">{complexToStr(card.a, card.b)}</div>
      </div>
    );
  }
  if (card.kind === "binary") {
    return (
      <div className={cls} onClick={onClick}>
        <div className="text-sm text-gray-500">Binary Operation</div>
        <div className="mt-1 text-2xl font-mono">{card.op}</div>
        <div className="text-xs text-gray-400 font-mono">{card.op === "×" ? "z1 × z2" : card.op === "+" ? "z1 + z2" : "z1 - z2"}</div>
      </div>
    );
  }
  return (
    <div className={cls} onClick={onClick}>
      <div className="text-sm text-gray-500">Unary Operation</div>
      <div className="mt-1 text-lg font-mono">{card.op === "conj" ? <span style={{ textDecoration: "overline" }}>z</span> : card.op}</div>
      <div className="text-xs text-gray-400 font-mono">{card.op === "conj" ? <span style={{ textDecoration: "overline" }}>z</span> : card.op}</div>
    </div>
  );
}
