import { Game } from "./types/game";
import { User } from "./types/user";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import AsyncLock from 'async-lock';

export interface Database {
	users: Array<User>,
	games: Array<Game>,
}

const DB_DIR = (() => {
	const env = process.env.DB_DIR;
	if (!env) {
		return '.';
	}
	else {
		return env;
	}
})();

const DB_FILE = join(DB_DIR, 'db.json');
const dbLock = new AsyncLock();

export async function loadDatabase(): Promise<Database> {
	const contents = await (async () => {
		try {
			return JSON.parse(await readFile(DB_FILE, { encoding: "utf-8" }));
		}
		catch(e) {
			return {
				games: [],
				users: [],
			} as Database;
		}
	})();
	return contents;
}

export async function saveDatabase(db: Database, lock: boolean = true): Promise<void> {
	const action = async () => {
		const str = JSON.stringify(db);
		await writeFile(DB_FILE, str);
	};
	if (lock) {
		await dbLock.acquire("db", action);
	}
	else {
		await action();
	}
}

export async function useDatabase<T>(callback: (db: Database) => Promise<T>): Promise<T> {
	return await dbLock.acquire("db", async () => {
		const db = await loadDatabase();
		const result = await callback(db);
		await saveDatabase(db, false);
		return result;
	});
}

export async function upgradeDatabase(): Promise<void> {
	await useDatabase(async db => {
		// Add friends to users
		for (const user of db.users) {
			if (!user.friends && user.friends !== []) {
				user.friends = [];
			}
		}
	});
}
