export interface Game {
	id: string,
	state: GameState,
	moves: Array<[number, "X" | "O"]>,
	startTime: string,
	winIdx: number | null,
	players: {
		X: string,
		O: string,
	},
}

export type GameState = "movingX" | "movingO" | "winX" | "winO" | "draw"
