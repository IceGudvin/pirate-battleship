import type { Board, Cell, GameState, Ship, LogEntry } from './types'

const SIZE = 10
export const GRID_SIZE = SIZE
export const SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]

export function createEmptyBoard(): Board {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, (): Cell => ({
      shipId: null,
      hit: false,
      miss: false,
    }))
  )
}

function canPlace(board: Board, x: number, y: number, size: number, horizontal: boolean): boolean {
  if (horizontal ? x + size > SIZE : y + size > SIZE) return false
  for (let i = 0; i < size; i++) {
    const cx = x + (horizontal ? i : 0)
    const cy = y + (horizontal ? 0 : i)
    for (let ny = cy - 1; ny <= cy + 1; ny++) {
      for (let nx = cx - 1; nx <= cx + 1; nx++) {
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue
        if (board[ny][nx].shipId !== null) return false
      }
    }
  }
  return true
}

export function randomBoard(): { board: Board; ships: Ship[] } {
  const board = createEmptyBoard()
  const ships: Ship[] = []
  let shipId = 0

  for (const size of SHIP_SIZES) {
    let placed = false
    let attempts = 0
    while (!placed && attempts < 1000) {
      attempts++
      const horizontal = Math.random() < 0.5
      const x = Math.floor(Math.random() * SIZE)
      const y = Math.floor(Math.random() * SIZE)
      if (!canPlace(board, x, y, size, horizontal)) continue
      const cells: { x: number; y: number }[] = []
      for (let i = 0; i < size; i++) {
        const cx = x + (horizontal ? i : 0)
        const cy = y + (horizontal ? 0 : i)
        board[cy][cx].shipId = shipId
        cells.push({ x: cx, y: cy })
      }
      ships.push({ id: shipId, size, hits: 0, cells, horizontal, x, y })
      placed = true
      shipId++
    }
  }
  return { board, ships }
}

export function newGameState(): GameState {
  const { board: playerBoard, ships: playerShips } = randomBoard()
  const { board: aiBoard, ships: aiShips } = randomBoard()
  return {
    playerBoard,
    aiBoard,
    playerShips,
    aiShips,
    playerTurn: true,
    gameOver: false,
    phase: 'playing',
    aiMemory: [],
  }
}

function coordsToHuman(x: number, y: number): string {
  return String.fromCharCode(65 + y) + (x + 1)
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => ({ ...cell })))
}

function cloneShips(ships: Ship[]): Ship[] {
  return ships.map(s => ({ ...s, cells: [...s.cells] }))
}

export function playerAttack(
  state: GameState,
  x: number,
  y: number
): { nextState: GameState; logEntry: LogEntry | null } {
  const cell = state.aiBoard[y][x]
  if (cell.hit || cell.miss) return { nextState: state, logEntry: null }

  const aiBoard = cloneBoard(state.aiBoard)
  const aiShips = cloneShips(state.aiShips)
  const pos = coordsToHuman(x, y)
  const target = aiBoard[y][x]

  let logEntry: LogEntry
  let playerTurn = true
  let gameOver = false
  let phase = state.phase

  if (target.shipId !== null) {
    target.hit = true
    aiShips[target.shipId].hits++
    const ship = aiShips[target.shipId]
    const sunk = ship.hits >= ship.size
    if (sunk) {
      logEntry = { type: 'sunk', text: `☠ Вражеский корабль на ${pos} пошёл ко дну!` }
      if (aiShips.every(s => s.hits >= s.size)) {
        gameOver = true
        phase = 'player_won'
        logEntry = { type: 'sunk', text: `🏴‍☠️ Вражеский флот уничтожен! Победа!` }
      }
    } else {
      logEntry = { type: 'hit', text: `💥 Попадание по вражескому кораблю на ${pos}!` }
    }
  } else {
    target.miss = true
    logEntry = { type: 'miss', text: `🌊 Промах по ${pos}. Противник открывает огонь!` }
    playerTurn = false
  }

  return {
    nextState: { ...state, aiBoard, aiShips, playerTurn, gameOver, phase },
    logEntry,
  }
}

export function aiAttackStep(
  state: GameState
): { nextState: GameState; logEntry: LogEntry } {
  const playerBoard = cloneBoard(state.playerBoard)
  const playerShips = cloneShips(state.playerShips)
  const memory = [...state.aiMemory]

  const candidates: { x: number; y: number; priority: number }[] = []

  if (memory.length) {
    const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]
    for (const { x, y } of memory) {
      for (const d of dirs) {
        const nx = x + d.dx, ny = y + d.dy
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue
        const c = playerBoard[ny][nx]
        if (!c.hit && !c.miss) candidates.push({ x: nx, y: ny, priority: 0 })
      }
    }
  }

  if (!candidates.length) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = playerBoard[y][x]
        if (!c.hit && !c.miss) {
          candidates.push({ x, y, priority: (x + y) % 2 === 0 ? 1 : 2 })
        }
      }
    }
  }

  candidates.sort((a, b) => a.priority - b.priority)
  const pool = candidates.filter(c => c.priority === candidates[0].priority)
  const { x, y } = pool[Math.floor(Math.random() * pool.length)]
  const target = playerBoard[y][x]
  const pos = coordsToHuman(x, y)

  let logEntry: LogEntry
  let playerTurn = true
  let gameOver = false
  let phase = state.phase
  let newMemory: { x: number; y: number }[] = memory

  if (target.shipId !== null) {
    target.hit = true
    playerShips[target.shipId].hits++
    const ship = playerShips[target.shipId]
    const sunk = ship.hits >= ship.size
    if (sunk) {
      newMemory = []
      logEntry = { type: 'sunk', text: `☠ Твой корабль на ${pos} пошёл ко дну!` }
      if (playerShips.every(s => s.hits >= s.size)) {
        gameOver = true
        phase = 'ai_won'
        logEntry = { type: 'sunk', text: `💀 Твой флот уничтожен. Пираты победили!` }
      }
    } else {
      newMemory = [...memory, { x, y }]
      playerTurn = false
      logEntry = { type: 'hit', text: `💥 AI попал по твоему кораблю на ${pos}!` }
    }
  } else {
    target.miss = true
    logEntry = { type: 'miss', text: `🌊 AI промахнулся по ${pos}. Твой ход!` }
  }

  return {
    nextState: { ...state, playerBoard, playerShips, playerTurn, gameOver, phase, aiMemory: newMemory },
    logEntry,
  }
}
