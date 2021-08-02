export interface User {
	id: string,
	nickname: string,
	secret: string,
	stats: {
		local: UserStats,
		online: UserStats,
	},
	friends: Array<string>,
}

export interface UserStats {
	total: number,
	won: number,
}
